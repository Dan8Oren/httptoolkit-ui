import { observable, action, runInAction, computed, flow } from 'mobx';

import { lazyObservablePromise } from '../../util/observable';
import { RulesStore, UpstreamProxyType } from '../rules/rules-store';

/**
 * Talks to the device-service sidecar from my-httptoolkit/bin/device-service.js.
 *
 * This does NOT go through the HTTP Toolkit server: that server is a pinned
 * upstream release we deliberately don't fork, so it has no route for adb calls.
 * The sidecar owns them instead.
 *
 * Addressed by IP, never 'localhost' - the production CSP allows connect-src to
 * http://127.0.0.1:* but not to the hostname form.
 */
const DEVICE_SERVICE_PORT = 45460;
const BASE = `http://127.0.0.1:${DEVICE_SERVICE_PORT}`;

const POLL_INTERVAL = 5000;

export interface DeviceInfo {
    serial: string;
    state: string;
    name: string;
}

export interface MockedProvider {
    provider: string;
    lat: number | null;
    lon: number | null;
}

export interface CompetingApp {
    package: string;
    running: boolean;
}

export interface LocationStatus {
    device: string | null;
    mocked: boolean;
    providers: MockedProvider[];
    competing: CompetingApp[];
}

export interface Place {
    name: string;
    label: string;
    lat: number;
    lon: number;
    country: string;
    /** How the IP can follow this place, if at all. */
    egress: 'endpoint' | 'tor' | 'unavailable' | 'unknown';
    torExits: number | null;
}

export interface TorState {
    installed: boolean;
    running: boolean;
    country: string | null;
    socks: string;
}

/** Result of asking for a place: the two halves succeed independently. */
export interface PlaceResult {
    place: string;
    label: string;
    country: string;
    gps: { ok: boolean, lat?: number, lon?: number, error?: string } | null;
    egress: {
        ok: boolean,
        kind: 'endpoint' | 'tor' | 'none',
        endpoint?: EgressEndpoint,
        error?: string
    } | null;
}

/** A proxy used as HTTP Toolkit's upstream, i.e. where intercepted traffic exits. */
export interface EgressEndpoint {
    label: string;
    type: UpstreamProxyType;
    host: string;
    country?: string;
    /** Password-masked form, for rendering. `host` is what actually gets applied. */
    displayHost?: string;
    hasAuth?: boolean;
}

export interface EgressInfo {
    ok: boolean;
    ip?: string;
    country?: string;
    region?: string;
    isp?: string;
    error?: string;
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${BASE}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
    }
    return body as T;
}

export class DeviceStore {

    constructor(
        private rulesStore: RulesStore
    ) {}

    readonly initialized = lazyObservablePromise(async () => {
        await this.refresh();
        setInterval(() => this.refresh(), POLL_INTERVAL);
    });

    /** False until we've successfully reached the sidecar at least once. */
    @observable serviceAvailable = false;

    @observable devices: DeviceInfo[] = [];
    @observable places: Place[] = [];
    @observable tor: TorState | undefined;
    @observable lastResult: PlaceResult | undefined;
    @observable applying: string | undefined;
    @observable status: LocationStatus | undefined;

    @observable egressEndpoints: EgressEndpoint[] = [];
    @observable directEgress: EgressInfo | undefined;
    @observable egressChecks: { [label: string]: EgressInfo | 'checking' } = {};

    @observable lastError: string | undefined;
    @observable busy = false;

    /**
     * Where intercepted traffic currently exits. This is HTTP Toolkit's own upstream
     * proxy setting, which applies ONLY to proxied traffic - the Mac's own network
     * is untouched, which is the whole point of doing it this way rather than with
     * a VPN on the host.
     */
    @computed get activeEgress(): EgressEndpoint | undefined {
        const { upstreamProxyType, upstreamProxyHost } = this.rulesStore;
        if (upstreamProxyType === 'direct' || upstreamProxyType === 'system') return undefined;
        return this.egressEndpoints.find(e =>
            e.type === upstreamProxyType && e.host === upstreamProxyHost
        ) ?? { label: `${upstreamProxyType}://${upstreamProxyHost}`,
               type: upstreamProxyType, host: upstreamProxyHost! };
    }

    @computed get device(): DeviceInfo | undefined {
        return this.devices[0];
    }

    @computed get mockedPosition(): { lat: number, lon: number } | undefined {
        const withFix = this.status?.providers.find(p => p.lat != null && p.lon != null);
        return withFix ? { lat: withFix.lat!, lon: withFix.lon! } : undefined;
    }

    /** Apps other than us that hold MOCK_LOCATION and are running right now. */
    @computed get activeCompetingApps(): CompetingApp[] {
        return this.status?.competing.filter(c => c.running) ?? [];
    }

    @action.bound
    async refresh() {
        try {
            const [devices, status] = await Promise.all([
                api<DeviceInfo[]>('/devices'),
                api<LocationStatus>('/location')
            ]);

            const [places, egressEndpoints, tor] = await Promise.all([
                api<Place[]>('/places'),
                api<EgressEndpoint[]>('/egress'),
                api<TorState>('/tor')
            ]);

            runInAction(() => {
                this.serviceAvailable = true;
                this.devices = devices;
                this.status = status;
                this.places = places;
                this.egressEndpoints = egressEndpoints;
                this.tor = tor;
            });
        } catch (e) {
            runInAction(() => {
                this.serviceAvailable = false;
                this.devices = [];
                this.status = undefined;
            });
        }
    }

    setLocation = flow(function * (
        this: DeviceStore,
        position: { lat: number, lon: number, accuracy?: number, stopCompeting?: boolean }
    ) {
        this.busy = true;
        this.lastError = undefined;
        try {
            this.status = (yield api<LocationStatus>('/location', {
                method: 'POST',
                body: JSON.stringify(position)
            })) as LocationStatus;
        } catch (e) {
            this.lastError = (e as Error).message;
        } finally {
            this.busy = false;
        }
    });

    clearLocation = flow(function * (this: DeviceStore) {
        this.busy = true;
        this.lastError = undefined;
        try {
            this.status = (yield api<LocationStatus>('/location', {
                method: 'DELETE'
            })) as LocationStatus;
        } catch (e) {
            this.lastError = (e as Error).message;
        } finally {
            this.busy = false;
        }
    });

    /**
     * The one operation the page needs: put the device in a place. Sets GPS and
     * moves egress to match, in a single call. The two halves are reported
     * separately because GPS nearly always works and egress often cannot -
     * conflating them would mean silently half-applying a location.
     */
    setPlace = flow(function * (this: DeviceStore, place: string) {
        this.applying = place;
        this.lastError = undefined;
        try {
            const result = (yield api<PlaceResult>('/place', {
                method: 'POST',
                body: JSON.stringify({ place })
            })) as PlaceResult;

            this.lastResult = result;

            // The sidecar prepared the egress (starting Tor if needed); pointing
            // HTTP Toolkit at it is ours to do, since it's UI-side state.
            if (result.egress?.ok && result.egress.endpoint) {
                this.applyEgress(result.egress.endpoint);
            } else if (result.egress && !result.egress.ok) {
                this.applyEgress(undefined);
            }

            yield this.refresh();
        } catch (e) {
            this.lastError = (e as Error).message;
        } finally {
            this.applying = undefined;
        }
    });

    /** Point intercepted traffic at an endpoint, or back to direct. */
    @action.bound
    applyEgress(endpoint: EgressEndpoint | undefined) {
        if (!endpoint) {
            this.rulesStore.upstreamProxyType = 'direct';
            this.rulesStore.upstreamProxyHost = undefined;
        } else {
            this.rulesStore.upstreamProxyType = endpoint.type;
            this.rulesStore.upstreamProxyHost = endpoint.host;
        }
    }

    /**
     * Register NordVPN's SOCKS5 endpoints from service credentials. Nord exposes
     * SOCKS5 in three countries only, so this covers NL/SE/US - other Nord
     * locations exist but only as full VPN tunnels, which would move this whole
     * machine rather than just the device.
     */
    configureNordVpn = flow(function * (
        this: DeviceStore, username: string, password: string
    ) {
        this.busy = true;
        this.lastError = undefined;
        try {
            this.egressEndpoints = (yield api<EgressEndpoint[]>('/providers/nordvpn', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            })) as EgressEndpoint[];
            yield this.refresh();
        } catch (e) {
            this.lastError = (e as Error).message;
        } finally {
            this.busy = false;
        }
    });

    addEgress = flow(function * (this: DeviceStore, endpoint: EgressEndpoint) {
        this.busy = true;
        this.lastError = undefined;
        try {
            this.egressEndpoints = (yield api<EgressEndpoint[]>('/egress', {
                method: 'POST',
                body: JSON.stringify(endpoint)
            })) as EgressEndpoint[];
        } catch (e) {
            this.lastError = (e as Error).message;
        } finally {
            this.busy = false;
        }
    });

    removeEgress = flow(function * (this: DeviceStore, label: string) {
        this.busy = true;
        try {
            this.egressEndpoints = (yield api<EgressEndpoint[]>(
                `/egress?label=${encodeURIComponent(label)}`, { method: 'DELETE' }
            )) as EgressEndpoint[];
        } catch (e) {
            this.lastError = (e as Error).message;
        } finally {
            this.busy = false;
        }
    });

    /** Probe an endpoint without committing to it - what address does it exit from? */
    checkEgress = flow(function * (this: DeviceStore, endpoint: EgressEndpoint) {
        this.egressChecks = { ...this.egressChecks, [endpoint.label]: 'checking' };
        try {
            const result = (yield api<EgressInfo>(
                `/egress/check?type=${encodeURIComponent(endpoint.type)}` +
                `&host=${encodeURIComponent(endpoint.host)}`
            )) as EgressInfo;
            this.egressChecks = { ...this.egressChecks, [endpoint.label]: result };
        } catch (e) {
            this.egressChecks = {
                ...this.egressChecks,
                [endpoint.label]: { ok: false, error: (e as Error).message }
            };
        }
    });

    checkDirect = flow(function * (this: DeviceStore) {
        try {
            this.directEgress = (yield api<EgressInfo>('/egress/direct')) as EgressInfo;
        } catch (e) {
            this.directEgress = { ok: false, error: (e as Error).message };
        }
    });
}
