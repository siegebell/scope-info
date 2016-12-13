// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as util from 'util';
import * as path from 'path';
import * as fs from 'fs';
import {DocumentController} from './document';
import * as tm from './text-mate';

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
      console.info(`Mapping language ${languageId} to initial scope ${matchingLanguages[0].scopeName}`);
      return matchingLanguages[0].scopeName;
    }
  } catch(err) { }
  console.info(`Cannot find a mapping for language ${languageId}; assigning default scope source.${languageId}`);
  return 'source.' + languageId;
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

let enabled = false;
//let workspaceState : vscode.Memento;

/** initialize everything; main entry point */
export function activate(context: vscode.ExtensionContext) : void {
  // workspaceState = context.workspaceState;

  function registerCommand(commandId:string, run:(...args:any[])=>void): void {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, run));
  }

  registerCommand('extension.disableScopeHover', disableScopeHover);
  registerCommand('extension.enableScopeHover', enableScopeHover);

  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(openDocument));
  context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(closeDocument));

  // reloadConfiguration();
  // if(workspaceState.get('enableScopeHover', true))
  //   enableScopeHover();
}


// /** Te user updated their settings.json */
// function onConfigurationChanged(){
//   reloadConfiguration();
// }

/** Re-read the settings and recreate substitutions for all documents */
function reloadConfiguration() {
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

async function disableScopeHover() {
  if(!enabled)
    return;
  // if(workspaceState.get('enableScopeHover') === false)
  //   return;
  // await workspaceState.update('enableScopeHover', false);
  enabled = false;
  unloadDocuments();
}

async function enableScopeHover() {
  // if(workspaceState.get('enableScopeHover') === true)
  //   return;
  // await workspaceState.update('enableScopeHover', true);
  if(enabled)
    return;
  enabled = true;
  reloadConfiguration();
}


async function loadGrammar(scopeName: string) : Promise<tm.IGrammar> {
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
  if(!enabled)
    return;
  // if(!workspaceState.get('enableScopeHover', false))
  //   return;
  const prettyDoc = documents.get(doc.uri);
  if(prettyDoc) {
    prettyDoc.refresh();
  } else if(textMateRegistry) {
    try {
      const scopeName = getLanguageScopeName(doc.languageId);
      const grammar = await loadGrammar(scopeName);
      documents.set(doc.uri, new DocumentController(doc, grammar));
    } catch(err) {}
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

