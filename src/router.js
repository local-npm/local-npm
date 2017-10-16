import React from 'react';
import { BrowserRouter, Switch, Route } from 'react-router-dom';

import Layout from './layout';
import Main from './main';
import Package from './package';

export default (
  <BrowserRouter>
    <Layout>
      <Switch>
        <Route exact path="/_browse" component={ Main } />
        <Route exact path="/_browse/package/:name" component={ Package } />
      </Switch>
    </Layout>
  </BrowserRouter>
);
