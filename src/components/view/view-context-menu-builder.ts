import * as _ from 'lodash';
import { runInAction } from 'mobx';

import { CollectedEvent, HttpExchangeView, WebSocketStream } from '../../types';

import { copyToClipboard } from '../../util/ui';

import { AccountStore } from '../../model/account/account-store';
import { UiStore } from '../../model/ui/ui-store';
import { HttpExchange } from '../../model/http/http-exchange';
import {
    exportHar,
    generateCodeSnippet,
    getCodeSnippetFormatKey,
    getCodeSnippetFormatName,
    getCodeSnippetOptionFromKey,
    snippetExportOptions
} from '../../model/ui/export';
import { ContextMenuItem } from '../../model/ui/context-menu';

export class ViewEventContextMenuBuilder {

    constructor(
        private accountStore: AccountStore,
        private uiStore: UiStore,

        private onPin: (event: CollectedEvent) => void,
        private onDelete: (event: CollectedEvent) => void,
        private onBuildRuleFromExchange: (exchange: HttpExchangeView) => void,
        private onPrepareToResendRequest?: (exchange: HttpExchangeView) => void
    ) {}

    private readonly BaseOptions = {
        Pin: {
            type: 'option',
            label: 'Toggle Pinning',
            callback: this.onPin
        },
        Delete: {
            type: 'option',
            label: 'Delete',
            callback: this.onDelete
        }
    } as const;

    getContextMenuCallback(event: CollectedEvent) {
        return (mouseEvent: React.MouseEvent) => {
            const preferredExportFormat = this.uiStore.exportSnippetFormat
                ? getCodeSnippetOptionFromKey(this.uiStore.exportSnippetFormat)
                : undefined;

            if (event.isHttp()) {
                const menuOptions = [
                    this.BaseOptions.Pin,
                    {
                        type: 'option',
                        label: 'Copy Request URL',
                        callback: (data: HttpExchangeView) => copyToClipboard(data.request.url)
                    },
                    ...(this.onPrepareToResendRequest ? [
                        {
                            type: 'option',
                            label: 'Resend Request',
                            callback: (data: HttpExchangeView) => this.onPrepareToResendRequest!(data)
                        }
                    ] as const : []),
                    {
                        type: 'option',
                        label: `Create Matching Modify Rule`,
                        callback: this.onBuildRuleFromExchange
                    },
                    {
                        type: 'option',
                        label: `Export Exchange as HAR`,
                        callback: exportHar
                    },
                    // If you have a preferred default format, we show that option at the top level:
                    ...(preferredExportFormat ? [{
                        type: 'option',
                        label: `Copy as ${getCodeSnippetFormatName(preferredExportFormat)} Snippet`,
                        callback: async (data: HttpExchange) => {
                            copyToClipboard(
                                await generateCodeSnippet(data, preferredExportFormat, {
                                    waitForBodyDecoding: true
                                })
                            );
                        }
                    }] as const : []),
                    {
                        type: 'submenu',
                        label: `Copy as Code Snippet`,
                        items: Object.keys(snippetExportOptions).map((snippetGroupName) => ({
                            type: 'submenu' as const,
                            label: snippetGroupName,
                            items: snippetExportOptions[snippetGroupName].map((snippetOption) => ({
                                type: 'option' as const,
                                label: getCodeSnippetFormatName(snippetOption),
                                callback: async (data: HttpExchange) => {
                                    // When you pick an option here, it updates your preferred default option
                                    runInAction(() => {
                                        this.uiStore.exportSnippetFormat = getCodeSnippetFormatKey(snippetOption);
                                    });

                                    copyToClipboard(
                                        await generateCodeSnippet(data, snippetOption, {
                                            waitForBodyDecoding: true
                                        })
                                    );
                                }
                            }))
                        }))
                    },
                    this.BaseOptions.Delete
                ];

                const sortedOptions = menuOptions as Array<ContextMenuItem<HttpExchange | WebSocketStream>>;

                this.uiStore.handleContextMenuEvent(
                    mouseEvent,
                    sortedOptions,
                    event
                )
            } else {
                // For non-HTTP events, we just show the super-basic globally supported options:
                this.uiStore.handleContextMenuEvent(mouseEvent, [
                    this.BaseOptions.Pin,
                    this.BaseOptions.Delete
                ], event);
            }
        };
    }

}