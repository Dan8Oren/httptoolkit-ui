import * as React from 'react';
import { action } from 'mobx';
import { observer, inject } from 'mobx-react';

import { CollectedEvent, ViewableEvent, HttpExchangeView } from '../../../types';
import { styled, css } from '../../../styles';
import { Ctrl } from '../../../util/ui';

import { RulesStore } from '../../../model/rules/rules-store';
import { AccountStore } from '../../../model/account/account-store';

import { HEADER_FOOTER_HEIGHT } from '../view-event-list-footer';
import { IconButton } from '../../common/icon-button';

const ButtonsContainer = styled.div`
    height: ${HEADER_FOOTER_HEIGHT}px;
    flex-shrink: 0;
    width: 100%;
    padding-left: 5px;
    box-sizing: border-box;

    background-color: ${p => p.theme.mainBackground};

    display: flex;

    align-items: center;
    justify-content: center;

    z-index: 1;
    box-shadow: 0 -10px 30px -5px rgba(0,0,0,${p => p.theme.boxShadowAlpha});
`;

const ScrollToButton = observer((p: {
    onClick: () => void
}) => <IconButton
    icon={['fas', 'eye']}
    title={'Scroll the list to show this exchange'}
    onClick={p.onClick}
/>);

const PinButton = styled(observer((p: {
    className?: string,
    pinned: boolean,
    onClick: () => void
}) => <IconButton
    className={p.className}
    icon={['fas', 'thumbtack']}
    title={
        (
            p.pinned
            ? "Unpin this exchange so it can be deleted"
            : "Pin this exchange, so it can't be deleted"
        ) + ` (${Ctrl}+P)`
    }
    onClick={p.onClick}
/>))`
    transition: transform 0.1s;

    ${p => !p.pinned && css`
        transform: rotate(45deg);
    `}
`;

const DeleteButton = observer((p: {
    pinned: boolean,
    onClick: () => void
}) => <IconButton
    icon={['far', 'trash-alt']}
    title={`Delete this exchange (${Ctrl}+Delete)`}
    onClick={p.onClick}
/>);

const ModifyButton = observer((p: {
    isExchange: boolean,
    onClick: () => void
}) => <IconButton
    icon='Pencil'
    onClick={p.onClick}
    title={`Create a modify rule from this exchange (${Ctrl}+m)`}
    disabled={!p.isExchange}
/>);

const SendButton = observer((p: {
    isExchange: boolean,
    onClick: () => void
}) => <IconButton
    icon='PaperPlaneTilt'
    onClick={p.onClick}
    title={`Resend this request (${Ctrl}+r)`}
    disabled={!p.isExchange}
/>);



export const HttpDetailsFooter = inject('rulesStore')(
    observer(
        (props: {
            rulesStore?: RulesStore,

            event: ViewableEvent,
            onDelete: (event: CollectedEvent) => void,
            onScrollToEvent: (event: CollectedEvent) => void,
            onBuildRuleFromExchange: (event: HttpExchangeView) => void,
            onPrepareToResendRequest?: (event: HttpExchangeView) => void,
            isPaidUser: boolean,
            navigate: (url: string) => void
        }) => {
            const { event } = props;
            const { pinned } = event;

            // Some actions require the collected event, not just the
            // current view.
            const collectedEvent = 'downstream' in event
                ? event.downstream
                : event;

            return <ButtonsContainer>
                <ScrollToButton
                    onClick={() => props.onScrollToEvent(collectedEvent)}
                />
                <PinButton
                    pinned={pinned}
                    onClick={action(() => {
                        event.pinned = !event.pinned;
                    })}
                />
                <DeleteButton
                    pinned={pinned}
                    onClick={() => props.onDelete(collectedEvent)}
                />

                <ModifyButton
                    isExchange={event.isHttp() && !event.isWebSocket()}
                    onClick={() => props.onBuildRuleFromExchange(props.event as HttpExchangeView)}
                />
                { props.onPrepareToResendRequest &&
                    <SendButton
                        isExchange={event.isHttp() && !event.isWebSocket()}
                        onClick={() => props.onPrepareToResendRequest!(
                            props.event as HttpExchangeView
                        )}
                    />
                }
            </ButtonsContainer>;
        }
    )
);