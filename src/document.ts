import * as vscode from 'vscode';
import * as textUtil from './text-util';
import * as tm from './text-mate';

const debugging = false;
const activeEditorDecorationTimeout = 20;
const inactiveEditorDecorationTimeout = 200;


export class DocumentController implements vscode.Disposable {
  private subscriptions : vscode.Disposable[] = [];

  // Stores the state for each line
  private grammarState : tm.StackElement[] = [];
  private grammar : tm.IGrammar;

  public constructor(doc: vscode.TextDocument, textMateGrammar: tm.IGrammar,
    private document = doc,
  ) {
    this.grammar = textMateGrammar;

    this.subscriptions.push(vscode.languages.registerHoverProvider(doc.languageId, {provideHover: (d,pos,tok) : vscode.Hover => {
      if(d.uri.toString() !== doc.uri.toString())
        return undefined;
      const state = this.grammarState[pos.line-1] || null;
      const line = doc.lineAt(pos.line);
      const tokens = this.grammar.tokenizeLine(line.text, state);
      for(let t of tokens.tokens) {
        if(t.startIndex <= pos.character && pos.character < t.endIndex)
          return {contents: t.scopes, range: new vscode.Range(pos.line,t.startIndex,pos.line,t.endIndex)}
      }
      return undefined;
    }}));
    
    // Parse whole document
    const docRange = new vscode.Range(0,0,this.document.lineCount,0);
    this.reparsePretties(docRange);

    this.subscriptions.push(vscode.workspace.onDidChangeTextDocument((e) => {
      if(e.document == this.document)
        this.onChangeDocument(e);
    }));
  }

  public dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }


  private refreshTokensOnLine(line: vscode.TextLine) : {tokens: tm.IToken[], invalidated: boolean} {
    if(!this.grammar)
      return {tokens: [], invalidated: false};
    const prevState = this.grammarState[line.lineNumber-1] || null;
    const lineTokens = this.grammar.tokenizeLine(line.text, prevState);
    const invalidated = !this.grammarState[line.lineNumber] || !lineTokens.ruleStack.equals(this.grammarState[line.lineNumber])
    this.grammarState[line.lineNumber] = lineTokens.ruleStack;
    return {tokens: lineTokens.tokens, invalidated: invalidated};
  }


  private reparsePretties(range: vscode.Range) : void {
    range = this.document.validateRange(range);

    const startCharacter = 0;

    let invalidatedTokenState = false;

    // Collect new pretties
    const lineCount = this.document.lineCount;
    let lineIdx;
    for(lineIdx = range.start.line; lineIdx <= range.end.line || (invalidatedTokenState && lineIdx < lineCount); ++lineIdx) {
      const line = this.document.lineAt(lineIdx);
      const {tokens: tokens, invalidated: invalidated} = this.refreshTokensOnLine(line);
      invalidatedTokenState = invalidated;
    }
  }

  private applyChanges(changes: vscode.TextDocumentContentChangeEvent[]) {
    const sortedChanges =
      changes.sort((change1,change2) => change1.range.start.isAfter(change2.range.start) ? -1 : 1)
    for(const change of sortedChanges) {
      try {
        const delta = textUtil.toRangeDelta(change.range, change.text);
        const editRange = textUtil.rangeDeltaNewRange(delta);

        const reparsed = this.reparsePretties(editRange);
      } catch(e) {
        console.error(e);
      }
    }
  }

  private onChangeDocument(event: vscode.TextDocumentChangeEvent) {
    this.applyChanges(event.contentChanges);
  }

  public refresh() {
    this.grammarState = [];
    const docRange = new vscode.Range(0,0,this.document.lineCount,0);
    this.reparsePretties(docRange);
  }
}