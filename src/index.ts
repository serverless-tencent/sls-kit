#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import yaml from 'js-yaml';
import fs from 'fs';
import util from 'util';
import 'dotenv/config';
import { copyProvision } from './copy-provision';
import { parseYml } from './parse-yml';

function parseServerlessYaml(str: string) {
    const data = yaml.load(str);
    return parseYml(data);
}
const copyProvisionCommandModule: yargs.CommandModule = {
    command: 'copy-provision',
    handler: async () => {
        const str = fs.readFileSync('./serverless.yml', { encoding: 'utf-8' });
        const data = parseServerlessYaml(str) as any;
        console.log("Parse serverless.yml:");
        console.log(util.inspect(data, { depth: null }));
        const { org, app, name, stage } = data;
        const { region, functions } = data.inputs;

        let functionList = [];
        if (Array.isArray(functions)) {
            functionList = data.inputs.functions.map((v: any) => {
                return { name: v.name ?? `${name}-${stage}-${app}-${v.key}`, namespace: v.namespace ?? 'default' }
            })
        } else {
            functionList = Object.entries(data.inputs.functions).map((v) => {
                const [key, value] = v;
                return { name: (value as any).name ?? `${name}-${stage}-${app}-${key}`, namespace: (value as any).namespace ?? 'default' };
            });
        }

        console.log("Functions and region:");
        console.log(util.inspect({ functions, region }, { depth: null }));

        await copyProvision(functions, region);
    },
};

yargs(hideBin(process.argv)).command(copyProvisionCommandModule).help().argv;