import { injectable } from 'inversify';
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getActivatedEnvVariables } from './index.node';
import { Resource } from '../../platform/common/types';
import { IEnvironmentActivationService } from '../../platform/interpreter/activation/types';
import { PythonEnvironment } from '../../platform/pythonEnvironments/info';
import { Uri } from 'vscode';

@injectable()
export class EnvironmentActivationService implements IEnvironmentActivationService {
    public getActivatedEnvironmentVariables(
        _resource: Resource,
        interpreter?: PythonEnvironment,
        _allowExceptions?: boolean
    ): Promise<NodeJS.ProcessEnv | undefined> {
        return getActivatedEnvVariables(interpreter?.uri || Uri.file(process.env.CI_PYTHON_PATH || 'python')!);
    }
    async hasActivationCommands(_resource: Resource, _interpreter?: PythonEnvironment): Promise<boolean> {
        return false;
    }
}
