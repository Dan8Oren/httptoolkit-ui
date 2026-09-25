import * as React from 'react';
import { observable, action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';

import { WithInjected } from '../../types';
import { styled, warningColor } from '../../styles';

import { DeviceStore, EgressEndpoint, Place, Drift } from '../../model/device/device-store';
import { UpstreamProxyType } from '../../model/rules/rules-store';

import { Button, SecondaryButton, TextInput, Select } from '../common/inputs';

const PROXY_TYPES: UpstreamProxyType[] =
    ['socks5h', 'socks5', 'socks4a', 'socks4', 'http', 'https'];

interface DevicePageProps {
    deviceStore: DeviceStore;
}

const DevicePageScrollContainer = styled.div`
    height: 100%;
    width: 100%;
    overflow-y: auto;
`;

const DevicePageContainer = styled.section`
    margin: 0px auto 20px;
    padding: 40px;
    max-width: 800px;
    position: relative;
`;

const DeviceHeading = styled.h1`
    font-size: ${p => p.theme.loudHeadingSize};
    font-family: ${p => p.theme.titleTextFamily};
    font-weight: bold;
    margin-bottom: 10px;
`;

const DeviceSubheading = styled.p`
    color: ${p => p.theme.mainColor};
    opacity: 0.8;
    margin-bottom: 40px;
`;

const Section = styled.section`
    background-color: ${p => p.theme.mainBackground};
    border-radius: 4px;
    box-shadow: 0 2px 10px 0 rgba(0,0,0,${p => p.theme.boxShadowAlpha});
    padding: 20px;
    margin-bottom: 20px;
`;

const SectionHeading = styled.h2`
    font-size: ${p => p.theme.headingSize};
    font-weight: bold;
    margin-bottom: 15px;
`;

const Row = styled.div`
    display: flex;
    align-items: flex-end;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 15px;
`;

const Field = styled.label`
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: ${p => p.theme.textSize};
`;

const CoordInput = styled(TextInput)`
    width: 120px;
`;

const AccuracyInput = styled(TextInput)`
    width: 70px;
`;

const StatusLine = styled.p`
    font-family: ${p => p.theme.monoFontFamily};
    font-size: ${p => p.theme.textSize};
    margin-top: 10px;
    line-height: 1.5;
`;

const Warning = styled.div`
    border-left: 3px solid ${warningColor};
    padding: 10px 15px;
    margin: 15px 0;
    line-height: 1.4;

    > button {
        margin-top: 10px;
    }
`;

const EndpointRow = styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid ${p => p.theme.containerBorder};

    &:last-child { border-bottom: none; }
`;

const EndpointLabel = styled.div<{ active: boolean }>`
    flex-grow: 1;
    font-weight: ${p => p.active ? 'bold' : 'normal'};

    > small {
        display: block;
        font-family: ${p => p.theme.monoFontFamily};
        opacity: 0.7;
    }
`;

const CheckResult = styled.small<{ ok: boolean }>`
    font-family: ${p => p.theme.monoFontFamily};
    color: ${p => p.ok ? p.theme.mainColor : warningColor};
`;

const HostInput = styled(TextInput)`
    width: 190px;
`;

const LabelInput = styled(TextInput)`
    width: 130px;
`;

const ErrorMessage = styled.p`
    color: ${warningColor};
    margin-top: 10px;
`;

@inject('deviceStore')
@observer
class DevicePage extends React.Component<DevicePageProps> {

    @observable private showAdvanced = false;

    /** Empty means "follow the place"; set once the user overrides it. */
    @observable private localeOverride = '';

    @action.bound private toggleAdvanced() { this.showAdvanced = !this.showAdvanced; }

    @action.bound private onPlaceChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const place = e.target.value;
        if (!place) return;
        // A new place re-suggests its language; drop any previous override so the
        // dropdown follows along until the user deliberately picks otherwise.
        this.localeOverride = '';
        this.props.deviceStore.setPlace(place);
    }

    /** What the language dropdown shows: an override, else the place's language. */
    @computed private get selectedLocale(): string {
        if (this.localeOverride) return this.localeOverride;
        const suggested = this.props.deviceStore.lastResult?.suggestedLocale;
        return suggested ?? this.props.deviceStore.deviceLocale?.locale ?? '';
    }

    @action.bound private onLocaleChange(e: React.ChangeEvent<HTMLSelectElement>) {
        this.localeOverride = e.target.value;
    }

    @action.bound private applyLocale() {
        const locale = this.selectedLocale;
        if (locale) this.props.deviceStore.setDeviceLocale(locale);
    }

    @observable private newLabel = '';
    @observable private newType: UpstreamProxyType = 'socks5h';
    @observable private newHost = '';
    @observable private newCountry = '';
    @observable private nordUser = '';
    @observable private nordPass = '';

    componentDidMount() {
        this.props.deviceStore.checkDirect();
    }

    @action.bound private onNewLabel(e: React.ChangeEvent<HTMLInputElement>) {
        this.newLabel = e.target.value;
    }
    @action.bound private onNewType(e: React.ChangeEvent<HTMLSelectElement>) {
        this.newType = e.target.value as UpstreamProxyType;
    }
    @action.bound private onNewHost(e: React.ChangeEvent<HTMLInputElement>) {
        this.newHost = e.target.value;
    }
    @action.bound private onNewCountry(e: React.ChangeEvent<HTMLInputElement>) {
        this.newCountry = e.target.value;
    }
    @action.bound private onNordUser(e: React.ChangeEvent<HTMLInputElement>) {
        this.nordUser = e.target.value;
    }
    @action.bound private onNordPass(e: React.ChangeEvent<HTMLInputElement>) {
        this.nordPass = e.target.value;
    }
    @action.bound private addNordVpn() {
        if (!this.nordUser.trim() || !this.nordPass.trim()) return;
        this.props.deviceStore.configureNordVpn(this.nordUser.trim(), this.nordPass.trim());
        this.nordUser = '';
        this.nordPass = '';
    }

    @action.bound private addEndpoint() {
        if (!this.newLabel.trim() || !this.newHost.trim()) return;
        this.props.deviceStore.addEgress({
            label: this.newLabel.trim(),
            type: this.newType,
            host: this.newHost.trim(),
            country: this.newCountry.trim().toLowerCase() || undefined
        });
        this.newLabel = '';
        this.newHost = '';
        this.newCountry = '';
    }

    private renderDrift() {
        const { drift, intended } = this.props.deviceStore;
        if (!drift || !intended) return null;

        const explain: Record<Exclude<Drift, null>, string> = {
            'gps-lost': `The device lost its mocked location — a reboot wipes it, ` +
                `since the test provider only lives in memory.`,
            'gps-moved': `The device's position no longer matches ${intended.label} — ` +
                `something else moved it.`,
            'no-device': `No device connected, so ${intended.label} isn't applied.`
        };

        return <Warning>
            <strong>Not currently in {intended.label}.</strong>
            <div>{ explain[drift] }</div>
            <div>
                { drift === 'no-device'
                    ? 'It will be re-applied when the device reconnects.'
                    : 'Re-applying automatically…' }
            </div>
        </Warning>;
    }

    private renderPlaceStatus() {
        const { lastResult, applying } = this.props.deviceStore;
        if (applying) return <StatusLine>Applying {applying}…</StatusLine>;
        if (!lastResult) return null;

        const { gps, egress, label } = lastResult;
        return <StatusLine>
            <strong>{ label }</strong><br />
            GPS: { gps?.ok
                ? `${gps.lat}, ${gps.lon}`
                : `failed — ${gps?.error ?? 'unknown error'}` }
            <br />
            IP: { egress?.ok
                ? `via ${egress.endpoint?.label}`
                : egress?.error ?? 'unchanged' }
        </StatusLine>;
    }

    private renderAdvanced() {
        const { deviceStore } = this.props;
        const {
            egressEndpoints, egressChecks, activeEgress, directEgress, busy, tor
        } = deviceStore;

        return <>
            <SectionHeading>NordVPN</SectionHeading>
            <p>
                Adds NordVPN's SOCKS5 endpoints in one step. Use the{' '}
                <strong>service credentials</strong> from your Nord dashboard, not
                your account email and password.
            </p>
            <Warning>
                Nord exposes SOCKS5 in <strong>Netherlands, Sweden and the United
                States only</strong>. Its other locations — Egypt included — exist
                as full VPN tunnels, which would reroute this entire Mac rather
                than just the device.
            </Warning>
            <Row>
                <Field>
                    Service username
                    <LabelInput value={this.nordUser} onChange={this.onNordUser} />
                </Field>
                <Field>
                    Service password
                    <LabelInput type='password' value={this.nordPass}
                        onChange={this.onNordPass} />
                </Field>
                <Button onClick={this.addNordVpn}
                    disabled={!this.nordUser.trim() || !this.nordPass.trim() || busy}>
                    Add NordVPN endpoints
                </Button>
            </Row>

            <SectionHeading>Egress endpoints</SectionHeading>
            <p>
                Used in preference to Tor when one matches the country you pick —
                add a commercial provider's SOCKS5 endpoint here (NordVPN, Mullvad
                and similar), with <code>user:pass@host:port</code> if it needs auth.
            </p>

            { egressEndpoints.map(endpoint => {
                const check = egressChecks[endpoint.label];
                const isActive = activeEgress?.host === endpoint.host;

                return <EndpointRow key={endpoint.label}>
                    <EndpointLabel active={isActive}>
                        { endpoint.label }
                        { endpoint.country && ` · ${endpoint.country.toUpperCase()}` }
                        { isActive && ' — active' }
                        <small>{ endpoint.type }://{ endpoint.displayHost ?? endpoint.host }</small>
                        { check === 'checking'
                            ? <CheckResult ok={true}>checking…</CheckResult>
                        : check
                            ? <CheckResult ok={check.ok}>
                                { check.ok ? `${check.ip} — ${check.country}`
                                           : `failed: ${check.error}` }
                            </CheckResult>
                        : null }
                    </EndpointLabel>
                    <SecondaryButton onClick={() => deviceStore.checkEgress(endpoint)}>
                        Test
                    </SecondaryButton>
                    <SecondaryButton onClick={() => deviceStore.removeEgress(endpoint.label)}>
                        Remove
                    </SecondaryButton>
                </EndpointRow>;
            }) }

            <Row>
                <Field>
                    Label
                    <LabelInput value={this.newLabel} onChange={this.onNewLabel}
                        placeholder='Nord NL' />
                </Field>
                <Field>
                    Country
                    <LabelInput value={this.newCountry} onChange={this.onNewCountry}
                        placeholder='nl' />
                </Field>
                <Field>
                    Type
                    <Select value={this.newType} onChange={this.onNewType}>
                        { PROXY_TYPES.map(t =>
                            <option key={t} value={t}>{ t }</option>
                        ) }
                    </Select>
                </Field>
                <Field>
                    Host:port
                    <HostInput value={this.newHost} onChange={this.onNewHost}
                        placeholder='user:pass@host:1080' />
                </Field>
                <Button onClick={this.addEndpoint}
                    disabled={!this.newLabel.trim() || !this.newHost.trim() || busy}>
                    Add
                </Button>
            </Row>

            <StatusLine>
                Tor: { !tor?.installed
                    ? 'not installed — run `brew install tor` for automatic country switching'
                    : tor.running
                        ? `running, exit country ${tor.country}, socks at ${tor.socks}`
                        : 'installed, not running' }
                <br />
                This Mac exits via { directEgress?.ok
                    ? `${directEgress.ip} (${directEgress.country})` : '…' }
            </StatusLine>

            <Row>
                <SecondaryButton onClick={() => deviceStore.applyEgress(undefined)}
                    disabled={!activeEgress}>
                    Reset IP to direct
                </SecondaryButton>
                <SecondaryButton onClick={deviceStore.checkDirect}>
                    Re-check this Mac
                </SecondaryButton>
            </Row>
        </>;
    }

    render() {
        const { deviceStore } = this.props;
        const {
            serviceAvailable, device, places, busy, lastError,
            activeCompetingApps, activeEgress, status, mockedPosition
        } = deviceStore;

        if (!serviceAvailable) {
            return <DevicePageScrollContainer>
                <DevicePageContainer>
                    <DeviceHeading>Device</DeviceHeading>
                    <Section>
                        <SectionHeading>Device service unavailable</SectionHeading>
                        <p>
                            Can't reach the device service on 127.0.0.1:45460. It is
                            started by <code>bin/start.sh</code> alongside the server
                            and UI — restart via the launcher, or run{' '}
                            <code>node bin/device-service.js</code> by hand.
                        </p>
                    </Section>
                </DevicePageContainer>
            </DevicePageScrollContainer>;
        }

        return <DevicePageScrollContainer>
            <DevicePageContainer>
                <DeviceHeading>Device</DeviceHeading>
                <DeviceSubheading>
                    { device ? `${device.name} (${device.serial})`
                             : 'No ADB device connected' }
                </DeviceSubheading>

                <Section>
                    <SectionHeading>Where is this device?</SectionHeading>
                    <p>
                        Sets the GPS position and moves the device's apparent IP to
                        match. Only intercepted traffic is rerouted — this Mac's own
                        connections are untouched.
                    </p>

                    <Row>
                        <Field>
                            Location
                            <Select
                                defaultValue=''
                                onChange={this.onPlaceChange}
                                disabled={!device || !!busy}
                            >
                                <option value=''>Choose a place…</option>
                                { places.map((place: Place) =>
                                    <option key={place.name} value={place.name}>
                                        { place.label }
                                        { place.egress === 'unavailable'
                                            ? '  (GPS only — no IP available)'
                                        : place.egress === 'endpoint'
                                            ? '  (GPS + your endpoint)'
                                        : place.egress === 'tor-slow'
                                            ? `  (GPS + IP — only ${place.torExits} relays, slow)`
                                        : '  (GPS + IP)' }
                                    </option>
                                ) }
                            </Select>
                        </Field>
                    </Row>

                    { this.renderDrift() }
                    { this.renderPlaceStatus() }

                    <Row>
                        <Field>
                            Language
                            <Select
                                value={this.selectedLocale}
                                onChange={this.onLocaleChange}
                                disabled={!device || deviceStore.localeChanging}
                            >
                                { deviceStore.locales.map(l =>
                                    <option key={l.tag} value={l.tag}>{ l.name }</option>
                                ) }
                            </Select>
                        </Field>
                        <SecondaryButton
                            onClick={this.applyLocale}
                            disabled={
                                !device ||
                                deviceStore.localeChanging ||
                                !this.selectedLocale ||
                                this.selectedLocale === deviceStore.deviceLocale?.locale
                            }
                        >
                            { deviceStore.localeChanging
                                ? 'Restarting…'
                                : 'Apply language' }
                        </SecondaryButton>
                    </Row>

                    { this.selectedLocale &&
                      this.selectedLocale !== deviceStore.deviceLocale?.locale &&
                      !deviceStore.localeChanging &&
                        <Warning>
                            Changing the language restarts the device's UI (~30s) and
                            <strong> drops interception</strong> — you'll need to
                            re-activate it afterwards. Everything else about a place
                            applies instantly; this is the one that costs something.
                        </Warning>
                    }

                    { activeCompetingApps.length > 0 && <Warning>
                        <strong>Another app is mocking location.</strong>
                        <div>
                            { activeCompetingApps.map(a => a.package).join(', ') }
                            {' '}will overwrite this. It gets stopped automatically
                            when you pick a place.
                        </div>
                    </Warning> }

                    { lastError && <ErrorMessage>{ lastError }</ErrorMessage> }

                    <StatusLine>
                        Asked for: { deviceStore.intended?.label ?? 'nothing yet' }
                        <br />
                        Device: { deviceStore.deviceLocale?.locale ?? '?' }
                        {' · '}
                        { deviceStore.deviceLocale?.timezone ?? '?' }
                        <br />
                        Now: { status?.mocked && mockedPosition
                            ? `GPS ${mockedPosition.lat}, ${mockedPosition.lon}`
                            : 'GPS not mocked' }
                        {' · '}
                        { activeEgress ? `IP via ${activeEgress.label}` : 'IP direct' }
                    </StatusLine>

                    <Row>
                        <SecondaryButton onClick={deviceStore.clearLocation}
                            disabled={!device || !!busy}>
                            Clear GPS
                        </SecondaryButton>
                        <SecondaryButton onClick={this.toggleAdvanced}>
                            { this.showAdvanced ? 'Hide advanced' : 'Advanced…' }
                        </SecondaryButton>
                    </Row>
                </Section>

                { this.showAdvanced && <Section>{ this.renderAdvanced() }</Section> }
            </DevicePageContainer>
        </DevicePageScrollContainer>;
    }
}

// Annoying cast required to handle the store prop nicely in our types
const InjectedDevicePage = DevicePage as unknown as WithInjected<
    typeof DevicePage,
    'deviceStore'
>;
export { InjectedDevicePage as DevicePage };
