'use strict';

import polyfill from 'babel/polyfill';
import React from 'react';
import {Main} from './components/main';

React.render(React.createElement(Main), document.getElementById('app'));
