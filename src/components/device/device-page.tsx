import * as React from 'react';
import { observable, action, computed } from 'mobx';
import { observer, inject } from 'mobx-react';

import { WithInjected } from '../../types';
import { styled, warningColor } from '../../styles';

import { DeviceStore } from '../../model/device/device-store';

import { Button, SecondaryButton, TextInput, Select } from '../common/inputs';

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

const ErrorMessage = styled.p`
    color: ${warningColor};
    margin-top: 10px;
`;

@inject('deviceStore')
@observer
class DevicePage extends React.Component<DevicePageProps> {

    @observable private lat = '';
    @observable private lon = '';
    @observable private accuracy = '5';
    @observable private selectedCity = '';

    @computed private get parsed(): { lat: number, lon: number } | undefined {
        const lat = parseFloat(this.lat);
        const lon = parseFloat(this.lon);
        if (!isFinite(lat) || !isFinite(lon)) return undefined;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
        return { lat, lon };
    }

    @action.bound
    private onCityChange(event: React.ChangeEvent<HTMLSelectElement>) {
        const name = event.target.value;
        this.selectedCity = name;

        const city = this.props.deviceStore.cities.find(c => c.name === name);
        if (city) {
            this.lat = String(city.lat);
            this.lon = String(city.lon);
        }
    }

    @action.bound
    private onLatChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.lat = e.target.value;
        this.selectedCity = '';
    }

    @action.bound
    private onLonChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.lon = e.target.value;
        this.selectedCity = '';
    }

    @action.bound
    private onAccuracyChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.accuracy = e.target.value;
    }

    @action.bound
    private apply(stopCompeting = false) {
        const position = this.parsed;
        if (!position) return;

        const accuracy = parseFloat(this.accuracy);
        this.props.deviceStore.setLocation({
            ...position,
            accuracy: isFinite(accuracy) ? accuracy : undefined,
            stopCompeting
        });
    }

    render() {
        const { deviceStore } = this.props;
        const {
            serviceAvailable, device, cities, status, busy, lastError,
            mockedPosition, activeCompetingApps
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
                    { device
                        ? `${device.name} (${device.serial})`
                        : 'No ADB device connected' }
                </DeviceSubheading>

                <Section>
                    <SectionHeading>GPS location</SectionHeading>

                    <Row>
                        <Field>
                            Preset
                            <Select
                                value={this.selectedCity}
                                onChange={this.onCityChange}
                                disabled={!device}
                            >
                                <option value=''>Custom…</option>
                                { cities.map(city =>
                                    <option key={city.name} value={city.name}>
                                        { city.name }
                                    </option>
                                ) }
                            </Select>
                        </Field>

                        <Field>
                            Latitude
                            <CoordInput
                                value={this.lat}
                                onChange={this.onLatChange}
                                placeholder='52.5200'
                                disabled={!device}
                            />
                        </Field>

                        <Field>
                            Longitude
                            <CoordInput
                                value={this.lon}
                                onChange={this.onLonChange}
                                placeholder='13.4050'
                                disabled={!device}
                            />
                        </Field>

                        <Field>
                            Accuracy (m)
                            <AccuracyInput
                                value={this.accuracy}
                                onChange={this.onAccuracyChange}
                                disabled={!device}
                            />
                        </Field>
                    </Row>

                    <Row>
                        <Button
                            onClick={() => this.apply(false)}
                            disabled={!device || !this.parsed || busy}
                        >
                            { busy ? 'Applying…' : 'Apply' }
                        </Button>
                        <SecondaryButton
                            onClick={deviceStore.clearLocation}
                            disabled={!device || busy}
                        >
                            Clear
                        </SecondaryButton>
                    </Row>

                    { activeCompetingApps.length > 0 && <Warning>
                        <strong>Another app is mocking location.</strong>
                        <div>
                            { activeCompetingApps.map(a => a.package).join(', ') }
                            {' '}holds MOCK_LOCATION and is running, so it will
                            overwrite whatever you set here within seconds.
                        </div>
                        <SecondaryButton
                            onClick={() => this.apply(true)}
                            disabled={!this.parsed || busy}
                        >
                            Stop it and apply
                        </SecondaryButton>
                    </Warning> }

                    { lastError && <ErrorMessage>{ lastError }</ErrorMessage> }

                    <StatusLine>
                        { status?.mocked && mockedPosition
                            ? <>
                                Mocked: { mockedPosition.lat }, { mockedPosition.lon }
                                <br />
                                Providers: { status.providers.map(p => p.provider).join(', ') }
                            </>
                            : 'Not currently mocked — the device reports its real position.' }
                    </StatusLine>
                </Section>
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
