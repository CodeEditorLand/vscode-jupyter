// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { inject, injectable, named } from 'inversify';
import { Memento, Uri } from 'vscode';
import { IExtensionSyncActivationService } from '../../../platform/activation/types';
import { GLOBAL_MEMENTO, IDisposableRegistry, IMemento } from '../../../platform/common/types';
import { noop } from '../../../platform/common/utils/misc';
import { LiveRemoteKernelConnectionMetadata } from '../../types';
import {
    IJupyterServerUriEntry,
    IJupyterServerUriStorage,
    ILiveRemoteKernelConnectionUsageTracker,
    JupyterServerProviderHandle
} from '../types';

export const mementoKeyToTrackRemoveKernelUrisAndSessionsUsedByResources = 'removeKernelUrisAndSessionsUsedByResources';

type ServerId = string;
type KernelId = string;
type UriString = string;
type UriSessionUsedByResources = Record<ServerId, Record<KernelId, UriString[]>>;

/**
 * Keeps track of the kernel id and server id that was last used by a resource.
 * If a kernel is no longer used by a resource (e.g. another kernel is selected),
 * then the previous kernel would be removed from the list of kernels for this resource.
 */
@injectable()
export class LiveRemoteKernelConnectionUsageTracker
    implements IExtensionSyncActivationService, ILiveRemoteKernelConnectionUsageTracker
{
    private usedRemoteKernelServerIdsAndSessions: UriSessionUsedByResources = {};
    constructor(
        @inject(IDisposableRegistry) private readonly disposables: IDisposableRegistry,
        @inject(IJupyterServerUriStorage) private readonly uriStorage: IJupyterServerUriStorage,
        @inject(IMemento) @named(GLOBAL_MEMENTO) private readonly memento: Memento
    ) {}
    public activate(): void {
        this.usedRemoteKernelServerIdsAndSessions = this.memento.get<UriSessionUsedByResources>(
            mementoKeyToTrackRemoveKernelUrisAndSessionsUsedByResources,
            {}
        );
        this.uriStorage.onDidRemove(this.onDidRemoveUris, this, this.disposables);
    }

    public wasKernelUsed(connection: LiveRemoteKernelConnectionMetadata) {
        const serverId = this.computeId(connection.providerHandle);
        return (
            serverId in this.usedRemoteKernelServerIdsAndSessions &&
            typeof connection.kernelModel.id === 'string' &&
            connection.kernelModel.id in this.usedRemoteKernelServerIdsAndSessions[serverId]
        );
    }
    public trackKernelIdAsUsed(resource: Uri, providerHandle: JupyterServerProviderHandle, kernelId: string) {
        const serverId = this.computeId(providerHandle);
        this.usedRemoteKernelServerIdsAndSessions[serverId] = this.usedRemoteKernelServerIdsAndSessions[serverId] || {};
        this.usedRemoteKernelServerIdsAndSessions[serverId][kernelId] =
            this.usedRemoteKernelServerIdsAndSessions[serverId][kernelId] || [];
        const uris = this.usedRemoteKernelServerIdsAndSessions[serverId][kernelId];
        if (uris.includes(resource.toString())) {
            return;
        }
        uris.push(resource.toString());
        this.memento
            .update(
                mementoKeyToTrackRemoveKernelUrisAndSessionsUsedByResources,
                this.usedRemoteKernelServerIdsAndSessions
            )
            .then(noop, noop);
    }
    public trackKernelIdAsNotUsed(resource: Uri, providerHandle: JupyterServerProviderHandle, kernelId: string) {
        const serverId = this.computeId(providerHandle);
        if (!(serverId in this.usedRemoteKernelServerIdsAndSessions)) {
            return;
        }
        if (!(kernelId in this.usedRemoteKernelServerIdsAndSessions[serverId])) {
            return;
        }
        const uris = this.usedRemoteKernelServerIdsAndSessions[serverId][kernelId];
        if (!Array.isArray(uris) || !uris.includes(resource.toString())) {
            return;
        }
        uris.splice(uris.indexOf(resource.toString()), 1);
        if (uris.length === 0) {
            delete this.usedRemoteKernelServerIdsAndSessions[serverId][kernelId];
        }
        if (Object.keys(this.usedRemoteKernelServerIdsAndSessions[serverId]).length === 0) {
            delete this.usedRemoteKernelServerIdsAndSessions[serverId];
        }

        this.memento
            .update(
                mementoKeyToTrackRemoveKernelUrisAndSessionsUsedByResources,
                this.usedRemoteKernelServerIdsAndSessions
            )
            .then(noop, noop);
    }
    private onDidRemoveUris(uriEntries: IJupyterServerUriEntry[]) {
        uriEntries.forEach((uriEntry) => {
            const serverId = this.computeId(uriEntry.provider);
            delete this.usedRemoteKernelServerIdsAndSessions[serverId];
            this.memento
                .update(
                    mementoKeyToTrackRemoveKernelUrisAndSessionsUsedByResources,
                    this.usedRemoteKernelServerIdsAndSessions
                )
                .then(noop, noop);
        });
    }
    private computeId(providerHandle: JupyterServerProviderHandle) {
        return `${providerHandle.id}#${providerHandle.handle}`;
    }
}
