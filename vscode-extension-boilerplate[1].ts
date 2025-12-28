
/**
 * BLACK SCORPION - VS CODE EXTENSION BRIDGE (v5.2)
 * 
 * INSTRUCTIONS:
 * 1. Open your VS Code extension project.
 * 2. Replace the contents of 'src/extension.ts' with this code.
 * 3. Add the following to your 'package.json':
 * 
 * "contributes": {
 *   "commands": [
 *     {
 *       "command": "blackscorpion.fixTerminalError",
 *       "title": "Black Scorpion: Analyze Terminal Error",
 *       "icon": "$(zap)"
 *     }
 *   ],
 *   "menus": {
 *     "terminal/context": [
 *       {
 *         "command": "blackscorpion.fixTerminalError",
 *         "group": "navigation"
 *       }
 *     ]
 *   }
 * }
 */

import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let panel: vscode.WebviewPanel | undefined = undefined;

    const fixCommand = vscode.commands.registerCommand('blackscorpion.fixTerminalError', async () => {
        // Step 1: Force a copy selection command to ensure we have the text
        await vscode.commands.executeCommand('workbench.action.terminal.copySelection');
        
        // Step 2: Read selection from clipboard
        const selection = await vscode.env.clipboard.readText();
        
        if (!selection || selection.trim().length === 0) {
            vscode.window.showWarningMessage('Black Scorpion: No terminal text selected. Please select the error text first.');
            return;
        }

        // Step 3: Show status feedback
        vscode.window.setStatusBarMessage(`$(sync~spin) Black Scorpion: Transmitting pulse...`, 2000);

        // Step 4: Manage the Diagnostic Panel
        if (panel) {
            panel.reveal(vscode.ViewColumn.Beside);
        } else {
            panel = vscode.window.createWebviewPanel(
                'blackScorpionWarrior',
                'Black Scorpion vs Code Warrior Diagnostic',
                vscode.ViewColumn.Beside,
                { 
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            panel.onDidDispose(() => { panel = undefined; }, null, context.subscriptions);
            panel.webview.html = getWebviewContent();
        }

        // Step 5: Send the terminal data to the webview
        panel.webview.postMessage({
            type: 'TERMINAL_ERROR_PAYLOAD',
            data: selection
        });
    });

    context.subscriptions.push(fixCommand);
}

function getWebviewContent() {
    // Note: Update this URL to your deployed production app
    const appUrl = "https://black-scorpion-app.azurewebsites.net"; 

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body, html { margin: 0; padding: 0; height: 100%; overflow: hidden; background: #020617; }
            iframe { border: none; width: 100%; height: 100%; }
            .loading { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; color: #10b981; font-family: sans-serif; }
        </style>
    </head>
    <body>
        <div id="status" class="loading">Establishing Warrior Bridge...</div>
        <iframe id="bridge" src="${appUrl}" onload="document.getElementById('status').style.display='none';"></iframe>
        <script>
            const vscode = acquireVsCodeApi();
            const bridge = document.getElementById('bridge');
            window.addEventListener('message', event => {
                const message = event.data;
                if (message.type === 'TERMINAL_ERROR_PAYLOAD') {
                    bridge.contentWindow.postMessage(message, '*');
                }
            });
        </script>
    </body>
    </html>`;
}
