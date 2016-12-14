// 
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';
import * as path from 'path';
import * as util from 'util';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as ext from '../src/extension';
import * as api from '../src/scope-info';

// Defines a Mocha test suite to group tests of similar kind together
suite("Scope Info", function () {
  let si : api.ScopeInfoAPI;
  test("api - getScopeForLanguage", async function() {
    const siExt = vscode.extensions.getExtension<api.ScopeInfoAPI>('siegebell.scope-info');
    si = await siExt.activate();
    assert.equal(si.getScopeForLanguage("html"), "text.html.basic");
  });

  test("api - getGrammar", async function() {
    const siExt = vscode.extensions.getExtension<api.ScopeInfoAPI>('siegebell.scope-info');
    si = await siExt.activate();
    const g = await si.getGrammar("text.html.basic");
    const t = g.tokenizeLine("<!DOCTYPE html><body></body>", null);
    assert.equal(t.tokens.length, 11);
    assert.deepStrictEqual(t.tokens[0], {startIndex: 0, endIndex: 2, scopes: ['text.html.basic','meta.tag.sgml.html','punctuation.definition.tag.html']});
    assert.deepStrictEqual(t.tokens[1], {startIndex: 2, endIndex: 9, scopes: ['text.html.basic','meta.tag.sgml.html','meta.tag.sgml.doctype.html']});
    assert.deepStrictEqual(t.tokens[2], {startIndex: 9, endIndex: 14, scopes: ['text.html.basic','meta.tag.sgml.html','meta.tag.sgml.doctype.html']});
    assert.deepStrictEqual(t.tokens[7], {startIndex: 21, endIndex: 22, scopes: ['text.html.basic','meta.tag.any.html','punctuation.definition.tag.html','meta.scope.between-tag-pair.html']});
  });

  test("api - getScopeAt", async function() {
    const siExt = vscode.extensions.getExtension<api.ScopeInfoAPI>('siegebell.scope-info');
    si = await siExt.activate();
    const file = vscode.Uri.parse('untitled:C:\test.html');
    const doc = await vscode.workspace.openTextDocument(file);
    const ed = await vscode.window.showTextDocument(doc);
    await ed.edit(builder => {
      builder.insert(new vscode.Position(0,0), "<!DOCTYPE html>\n<body></body>")
    })
    const t1 = si.getScopeAt(doc, new vscode.Position(0,2));
    assert.equal(t1.text, "DOCTYPE");
    assert.deepStrictEqual(t1.range, new vscode.Range(0,2,0,9));
    assert.deepStrictEqual(t1.scopes, ['text.html.basic','meta.tag.sgml.html','meta.tag.sgml.doctype.html']);
  });

});