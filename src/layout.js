import React from 'react';
import PropTypes from 'prop-types';

class Layout extends React.Component {
  render () {
    const { children } = this.props;

    return (
      <div style={{ height: '100%', width: '100%' }}>
        <div className="navbar">
          <div className="container">
            <div className="navbar-title">
              <a className="text-black" href="/_browse">
                <span style={{ fontSize: '30px' }} className="text-black">local-npm</span>
              </a>
            </div>
            <div className="nav">
              <a style={{ fontSize: '35px' }} className="text-black fa fa-github" href="https://github.com/local-npm/local-npm/"></a>
            </div>
          </div>
        </div>
        <div style={{ marginBottom: "60px" }}>
          { children }
        </div>
      </div>
    );
  }
}

Layout.propTypes = {
  children: PropTypes.object
};

export default Layout;
