import { observable, action, runInAction, computed, flow } from 'mobx';

import { lazyObservablePromise } from '../../util/observable';

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

export interface CityPreset {
    name: string;
    lat: number;
    lon: number;
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

    readonly initialized = lazyObservablePromise(async () => {
        await this.refresh();
        setInterval(() => this.refresh(), POLL_INTERVAL);
    });

    /** False until we've successfully reached the sidecar at least once. */
    @observable serviceAvailable = false;

    @observable devices: DeviceInfo[] = [];
    @observable cities: CityPreset[] = [];
    @observable status: LocationStatus | undefined;

    @observable lastError: string | undefined;
    @observable busy = false;

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

            // Cities never change; fetch once.
            const cities = this.cities.length
                ? this.cities
                : await api<CityPreset[]>('/cities');

            runInAction(() => {
                this.serviceAvailable = true;
                this.devices = devices;
                this.status = status;
                this.cities = cities;
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
}
