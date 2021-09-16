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
    describe: '从当前目录的 serverless.yml 读取 Multi-Scf 的函数列表，复制这些函数当前 $DEFAULT 流量的预置，并等待复制完毕后切换到当前最新的版本（以数字标识）因 Serverless Framework CLI 有 10m 超时时间，等待预置易导致超时，故在此添加预置切换命令\n',
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

const parseYmlCommandModule: yargs.CommandModule = {
    command: 'parse-yml',
    describe: '读取当前目录的 serverless.yml，解析其中的 ${env:xxx}, ${xxx} 等变量，并生成 serverless.parse.yml\n',
    handler: async () => {
        const str = fs.readFileSync('./serverless.yml', { encoding: 'utf-8' });
        const data = parseServerlessYaml(str) as any;
        console.log("Parse serverless.yml:");
        console.log(util.inspect(data, { depth: null }));

        fs.writeFileSync('./serverless.parse.yml', yaml.dump(data));
    },
};

yargs(hideBin(process.argv))
    .command(copyProvisionCommandModule)
    .command(parseYmlCommandModule).help().argv;