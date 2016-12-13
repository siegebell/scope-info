# Scope Info

An extension for vscode that provides TextMate scope information.

## For users

To view the TextMate scope information of your code, run `scope-info: enable hover information`; to disable, run `scope-info: disable hover information`.

## For extension authors

This extension provides an API by which your extension can query scope & token information. Refer to [api.ts](https://github.com/siegebell/scope-info/blob/master/src/api.ts) and [extension.test.ts](https://github.com/siegebell/scope-info/blob/master/test/extension.test.ts) for more details. Example usage:
```TypeScript
import * as api from 'api';
let doc : vscode.TextDocument;
const siExt = vscode.extensions.getExtension<api.ScopeInfoAPI>('siegebell.scope-info');
si = await siExt.activate();
const t1 : api.Token = si.getScopeAt(doc, new vscode.Position(0,2));
```