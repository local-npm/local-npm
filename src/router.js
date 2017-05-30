import React from 'react';
import { Router, Route, browserHistory } from 'react-router';

import Layout from './layout';
import Main from './main';
import Package from './package';

export default (
  <Router history={ browserHistory }>
    <Route component={ Layout }>
      <Route path="/_browse" component={ Main } />
      <Route path="/_browse/package/:name" component={ Package } />
    </Route>
  </Router>
);
