
import { Scf } from 'tencent-component-toolkit';
import util from 'util';

export async function copyProvision(functions: { name: string, namespace: string }[], region: string) {
    let functionInfoList: { name: string, namespace: string, currentVersion?: string, nextVersion?: string }[] = [...functions];
    const scf = new Scf({
        SecretId: process.env.TENCENT_SECRET_ID,
        SecretKey: process.env.TENCENT_SECRET_KEY,
        Token: process.env.TENCENT_TOKEN,
    }, region);

    // 获取当前和下一版本信息
    let i = 0;
    console.log("Getting function info:");
    for (const f of functions) {
        const res = await scf.alias.get({
            functionName: f.name,
            region,
            namespace: f.namespace,
            aliasName: '$DEFAULT',
        });

        const currentVersion = res.FunctionVersion;

        functionInfoList[i].currentVersion = currentVersion;
        const listRes = await scf.version.list({
            functionName: f.name,
            namespace: f.namespace,
        });

        // 拿到当前最大的数字版本
        const versions = listRes.FunctionVersion;
        let maxVersion = currentVersion;
        for (const v of versions) {
            const version = parseInt(v, 10);
            if (version > maxVersion) {
                maxVersion = version;
            }
        }

        if (maxVersion > currentVersion) {
            functionInfoList[i].nextVersion = `${maxVersion}`;
        }
        i++;
    }

    console.log("Function Version Info:");
    console.log(util.inspect(functionInfoList, { depth: null }));

    // 设置预置
    console.log("Setting provisioned:");
    for (const f of functionInfoList) {
        if (f.nextVersion) {
            await scf.scf.wait({
                functionName: f.name,
                namespace: f.namespace,
            });

            const res = await scf.concurrency.getProvisioned({
                functionName: f.name,
                namespace: f.namespace,
            } as any);
            const alloc = res.allocated.find((v) => {
                return `${v.qualifier}` == `${f.currentVersion}`
            });

            if (alloc) {
                console.log("Copy Function Provisioned:");
                await scf.concurrency.setProvisioned({
                    functionName: f.name,
                    namespace: f.namespace,
                    provisionedNum: alloc.allocatedNum,
                    qualifier: f.nextVersion,
                    // lastQualifier: `${f.currentVersion}`,
                });
            }
        }
    }

    // 等待预置完成
    console.log("Waiting provisioned finish:");
    for (const f of functionInfoList) {
        if (f.nextVersion) {
            await scf.concurrency.waitProvisioned({
                functionName: f.name,
                namespace: f.namespace,
            });

            const res = await scf.concurrency.getProvisioned({
                functionName: f.name,
                namespace: f.namespace,
            } as any);

            console.log("Current Function Provisioned:");
            console.log(util.inspect({ res }, { depth: null }));
        }
    }

    // 切版本
    console.log("Switch function version:");
    for (const f of functionInfoList) {
        if (f.nextVersion) {
            await scf.scf.wait({
                functionName: f.name,
                namespace: f.namespace,
            });

            await scf.alias.update({
                functionName: f.name,
                region,
                namespace: f.namespace,
                functionVersion: f.nextVersion,
                aliasName: '$DEFAULT',
            } as any);
        }
    }

    // 删除旧版本预置
    console.log("Removing old version provisioned:");
    for (const f of functionInfoList) {
        if (f.nextVersion && f.currentVersion) {
            while (true) {
                try {
                    await scf.concurrency.removeProvisioned({
                        functionName: f.name,
                        namespace: f.namespace,
                        qualifier: f.currentVersion,
                    });
                    break;
                } catch (err) {
                    console.log('Error, retrying...');
                    console.log(err);
                }
            }
        }
    }

    console.log("All functions provisioned has been copy and switch to new version!");
}