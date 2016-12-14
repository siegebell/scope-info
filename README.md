# Scope Info

An extension for vscode that provides TextMate scope information.

## For users

To view the TextMate scope information of your code, run `scope-info: enable hover information`; to disable, run `scope-info: disable hover information`.

## For extension authors

This extension provides an API by which your extension can query scope & token information. Refer to [scope-info.d.ts](https://github.com/siegebell/scope-info/blob/master/src/scope-info.d.ts) and [extension.test.ts](https://github.com/siegebell/scope-info/blob/master/test/extension.test.ts) for more details. Example usage:
```TypeScript
import * as vscode from 'vscode';
import * as scopeInfo from 'scope-info';

async function example(doc : vscode.TextDocument, pos: vscode.Position) : void {
  const siExt = vscode.extensions.getExtension<scopeInfo.ScopeInfoAPI>('siegebell.scope-info');
  const si = await siExt.activate();
  const token : scopeInfo.Token = si.getScopeAt(doc, pos);
}
```