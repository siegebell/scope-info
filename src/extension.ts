// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import {DocumentController} from './document';
import * as tm from './text-mate';
import * as api from './api';

/** Tracks all documents that substitutions are being applied to */
let documents = new Map<vscode.Uri,DocumentController>();

export let textMateRegistry : tm.Registry;

interface ExtensionGrammar {
  language?: string, scopeName?: string, path?: string, embeddedLanguages?: {[scopeName:string]:string}, injectTo?: string[]
}
interface ExtensionPackage {
  contributes?: {
    languages?: {id: string, configuration: string}[],
    grammars?: ExtensionGrammar[],
  }
}

function getLanguageScopeName(languageId: string) : string {
  try {
    const languages =
      vscode.extensions.all
      .filter(x => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars)
      .reduce((a: ExtensionGrammar[],b) => [...a, ...(b.packageJSON as ExtensionPackage).contributes.grammars], []);
    const matchingLanguages = languages.filter(g => g.language === languageId);
    
    if(matchingLanguages.length > 0) {
      // console.info(`Mapping language ${languageId} to initial scope ${matchingLanguages[0].scopeName}`);
      return matchingLanguages[0].scopeName;
    }
  } catch(err) { }
  return undefined;
}

const grammarLocator : tm.IGrammarLocator = {
  getFilePath: function(scopeName: string) : string {
    try {
      const grammars =
        vscode.extensions.all
        .filter(x => x.packageJSON && x.packageJSON.contributes && x.packageJSON.contributes.grammars)
        .reduce((a: (ExtensionGrammar&{extensionPath: string})[],b) => [...a, ...(b.packageJSON as ExtensionPackage).contributes.grammars.map(x => Object.assign({extensionPath: b.extensionPath}, x))], []);
      const matchingLanguages = grammars.filter(g => g.scopeName === scopeName);
      // let match : RegExpExecArray;
      // if(matchingLanguages.length === 0 && (match = /^source[.](.*)/.exec(scopeName)))
      //   matchingLanguages = grammars.filter(g => g.language === match[1]);
      
      if(matchingLanguages.length > 0) {
        const ext = matchingLanguages[0];
        const file = path.join(ext.extensionPath, ext.path);
        console.info(`Found grammar for ${scopeName} at ${file}`)
        return file;
      }
    } catch(err) { }
    return undefined;
  }
}

async function provideHoverInfo(subscriptions: vscode.Disposable[]) {
  const allLanguages =
    (await vscode.languages.getLanguages())
    .filter(x => getLanguageScopeName(x) !== undefined);


  subscriptions.push(vscode.languages.registerHoverProvider(allLanguages, {provideHover: (doc,pos,tok) : vscode.Hover => {
    if(!isHoverEnabled())
      return;
    try {
      const prettyDoc = documents.get(doc.uri);
      if(prettyDoc) {
        const token = prettyDoc.getScopeAt(pos);
        if(token)
          return {contents: [`Token: \`${token.text}\``, ...token.scopes], range: token.range}
      }
    } catch(err) {
    }
    return undefined;
  }}));
}

export let workspaceState : vscode.Memento;

/** initialize everything; main entry point */
export function activate(context: vscode.ExtensionContext) : api.ScopeInfoAPI {
  workspaceState = context.workspaceState;

  function registerCommand(commandId:string, run:(...args:any[])=>void): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
  }

  registerCommand('extension.disableScopeHover', disableScopeHover);
  registerCommand('extension.enableScopeHover', enableScopeHover);

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(openDocument));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(closeDocument));
  
  provideHoverInfo(context.subscriptions);

  reloadGrammar();

  const api : api.ScopeInfoAPI = {
    getScopeAt(document: vscode.TextDocument, position: vscode.Position) : api.Token|null {
      try {
        const prettyDoc = documents.get(document.uri);
        if(prettyDoc) {
          return prettyDoc.getScopeAt(position);
        }
      } catch(err) {
      }
      return null;
    },
    getScopeForLanguage(language: string) : string|null {
      return getLanguageScopeName(language) || null;
    },
    async getGrammar(scopeName: string) : Promise<api.IGrammar|null> {
      try {
        if(textMateRegistry)
          return await loadGrammar(scopeName);
      } catch(err) { }
      return null;
    }
  }
  return api;
}

let hoverEnabled = false;
export function isHoverEnabled() : boolean {
  return hoverEnabled;
  // return workspaceState.get('showHoverInfo', false as boolean) === true;
}

export function setHover(enabled: boolean) : void {
  hoverEnabled = enabled;
  // workspaceState.update('showHoverInfo', enabled);
}

/** Re-read the settings and recreate substitutions for all documents */
function reloadGrammar() {
  try {
    textMateRegistry = new tm.Registry(grammarLocator);
  } catch(err) {
    textMateRegistry = undefined;
    console.error(err);
  }

  // Recreate the documents
  unloadDocuments();
  for(const doc of vscode.workspace.textDocuments)
    openDocument(doc);
}

function disableScopeHover() {
  setHover(false);
  unloadDocuments();
}

function enableScopeHover() {
  setHover(true);
  reloadGrammar();
}


function loadGrammar(scopeName: string) : Promise<tm.IGrammar> {
  return new Promise<tm.IGrammar>((resolve,reject) => {
    try {
      textMateRegistry.loadGrammar(scopeName, (err, grammar) => {
        if(err)
          reject(err)
        else
          resolve(grammar);
      })
    } catch(err) {
      reject(err);
    }
  })
}

async function openDocument(doc: vscode.TextDocument) {
  try {
    const prettyDoc = documents.get(doc.uri);
    if(prettyDoc) {
      prettyDoc.refresh();
    } else if(textMateRegistry) {
        const scopeName = getLanguageScopeName(doc.languageId);
        if(scopeName) {
          const grammar = await loadGrammar(scopeName);
          documents.set(doc.uri, new DocumentController(doc, grammar));
        }
    }
  } catch(err) {
  }
}

function closeDocument(doc: vscode.TextDocument) {
  const prettyDoc = documents.get(doc.uri);
  if(prettyDoc) {
    prettyDoc.dispose();
    documents.delete(doc.uri);
  }
}

function unloadDocuments() {
  for(const prettyDoc of documents.values()) {
    prettyDoc.dispose();
  }
  documents.clear();
}

/** clean-up; this extension is being unloaded */
export function deactivate() {
  unloadDocuments();
}

