
import _ from 'lodash';

export function flattenObj(data: any): any {
    let res: Record<string, string | number | boolean> = {};
    function work(obj: any, key = '') {
        obj;
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {
                const el = obj[i];
                work(el, key + '.' + i)
            }
            return;
        }
        if ((obj && typeof obj === 'object')) {
            for (let k of Object.keys(obj)) {
                work(obj[k], key + '.' + k);
            }
            return;
        }
        res[key.slice(1)] = obj;
    }

    work(data);

    return res;
}

export function fill(data: Record<string, string | number | boolean>) {
    data = JSON.parse(JSON.stringify(data));
    const reg = /\$\{.*?\}/g;
    while (true) {
        let hasReplace = false;
        for (let key of Object.keys(data)) {
            let value = data[key];
            if (typeof value === 'string') {
                let valueStr: string = value;
                const res = valueStr.match(reg) ?? [];
                for (let param of res) {
                    let paramOrigin = param;
                    param = param.slice(2, param.length - 1);
                    let paramValue: string | number | boolean | undefined = '';
                    if (param.startsWith('env:')) {
                        param = param.slice(4);
                        paramValue = process.env[param];
                        valueStr = valueStr.replace(new RegExp(_.escapeRegExp(paramOrigin), 'g'), `${paramValue}`);
                        hasReplace = true;
                    }
                    paramValue = data[param];
                    if (paramValue !== 'string' || (paramValue === 'string' && !paramValue.match(reg))) {
                        valueStr = valueStr.replace(new RegExp(_.escapeRegExp(paramOrigin), 'g'), `${paramValue}`);
                        hasReplace = true;
                    }
                }

                data[key] = valueStr;
            }
        }

        if (!hasReplace) {
            break;
        }
    }
    return data;
}

export function unflattenObj(data: Record<string, string | number | boolean>) {
    let res: any = {};
    for (let key of Object.keys(data)) {
        const keyList = key.split('.');
        let tmp = res;
        for (let i = 0; i < keyList.length; i++) {
            const keyPart = keyList[i];

            if (i === keyList.length - 1) {
                tmp[keyPart] = data[key];
            }
            else {
                if (!tmp[keyPart]) {
                    tmp[keyPart] = {};
                }
                tmp = tmp[keyPart];
            }
        }
    }

    function work(obj: any) {
        if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                obj[key] = work(obj[key]);
            }
            let allNumber = true;
            for (const key of Object.keys(obj)) {
                const num = parseInt(key, 10);
                if (Number.isNaN(num)) {
                    allNumber = false;
                }
            }

            if (allNumber) {
                let arr = [];
                for (const key of Object.keys(obj)) {
                    const num = parseInt(key, 10);
                    arr[num] = obj[key];
                }
                return arr;
            }
        }

        return obj;
    }

    return work(res);
}

export function parseYml(data: any) {
    data = flattenObj(data);
    data = fill(data);
    data = unflattenObj(data);
    return data;
}