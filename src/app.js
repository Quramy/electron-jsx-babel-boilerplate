'use strict';
require('babel/polyfill');

import app from 'app';
import BrowserWindow from 'browser-window';
import crashReporter from 'crash-reporter';
import Menu from 'menu';
import appMenu from './browser/menu/appMenu';

let mainWindow = null;
if(process.env.NODE_ENV === 'develop'){
  crashReporter.start();
  //appMenu.append(devMenu);
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('ready', () => {
  //Menu.setApplicationMenu(appMenu);
  mainWindow = new BrowserWindow({
    width: 580,
    height: 365
  });
  mainWindow.loadUrl('file://' + __dirname + '/renderer/index.html');
  if(process.env.NODE_ENV === 'develop') {
    require('electron-connect').client.create(mainWindow);
  }
});

