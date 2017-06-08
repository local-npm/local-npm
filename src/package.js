import 'whatwg-fetch';

import React from 'react';
import moment from 'moment';
import Marked from 'marked';
import PropTypes from 'prop-types';
import { LineChart, CartesianGrid, Tooltip, Line } from 'recharts';

class Package extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
        doc: {}
    };

    this.findPackages(props.params.name);
  }
  findPackages(name) {
    const self = this;

    fetch(`/${name}`)
      .then(function(response) {
        return response.json()
      }).then(function(json) {
          self.setState({
              doc: json
          });
      }).catch(function(ex) {
        console.log('parsing failed', ex); // eslint-disable-line
      })
  }
  timeFormatter(v, l) {
      if(l == 'time') {
          return `${v} days`;
      }
      return v;
  }
  render() {
    const self = this;
    const { doc } = this.state;
    const { time, bugs, author, repository, license, description, homepage, readme, contributors, maintainers } = doc;
    const latest = doc['dist-tags'] && doc['dist-tags']['latest'];
    const keywords = latest && doc.versions[latest].keywords;

    const versionReleases = time && Object.keys(time).reverse().map((v, i) => {
        const current = moment(time[v]);
        const before = moment(time[Object.keys(time).reverse()[i - 1]]);

        if(current && before) {
            return {
                version: v,
                time: before.diff(current, 'days')
            }
        }
        return {
            version: v
        }
    }).filter((t) => parseInt(t.version) >= 0);
    const averageReleaseInDays = time && parseInt(versionReleases.map((v) => v.time).reduce((a, b) => a + b) / versionReleases.length);

    return (
        <div style={{ padding: '20px', margin: '0 auto', width: '80%' }} className="grid">
            <div className="col-7-12" style={{ borderRight: '1px solid #e9e9e9', paddingRight: '15px' }}>
                <div style={{ minHeight: '100px', borderBottom: '1px solid #e9e9e9', paddingBottom: '10px', marginBottom: '15px' }}>
                    <a className="btn" href="/_browse"> <span className="fa fa-arrow-left"></span> Back to Search </a>
                    <br/>
                    <br/>
                    <br/>
                    <div className="text-center" style={{ marginBottom: '10px' }}>
                        <a style={{ fontSize: '38px', color: 'black', borderBottom: '1px dotted #e9e9e9' }} href={ `package/${doc.name}` }>{doc.name}</a>
                        { license ? <span style={{ padding: '3px', display: 'inline-block', fontSize: '10px', color: '#9a9a9a', marginRight: '5px', marginLeft: '5px', borderRadius: '5px' }} className="badge"> { license } </span> : '' }
                        { latest ? <span style={{ fontWeight: 'bold', color: '#9a9a9a', fontSize: '12px' }}> { latest } </span> : '' }
                        { keywords && keywords.length > 0 ?
                            <div style={{ marginTop: '10px' }}>
                                <span className="fa fa-tag"> <small> { keywords.slice(0, 4).join(', ') } </small> </span>
                            </div>
                        : '' }
                        <div style={{ marginTop: '10px', marginBottom: '10px' }}> { description } </div>
                    </div>
                    <br/>
                    <br/>
                    { readme ?
                        <div>
                            <p style={{ fontWeight: '300', fontSize: '28px', margin: '0', borderBottom: '1px solid #e9e9e9' }}> readme </p>
                            <div className="readme" dangerouslySetInnerHTML={{ __html: Marked(readme) }}/>
                        </div>
                    : '' }
                </div>
            </div>
            <div className="col-5-12" style={{ paddingLeft: '15px' }}>
                { author ? <p> created by <a href={ author['url'] }> { author.name } </a> </p> : '' }
                { latest ? <p> latest version published <b>{ moment(doc.time[latest]).fromNow() }</b> </p> : '' }

                <p style={{ fontWeight: '300', fontSize: '28px', margin: '0', borderBottom: '1px solid #e9e9e9' }}> Links </p>

                { homepage ?
                    <a href={ homepage } className="btn text-left" style={{ margin: '10px 0', padding: '1% 2%', width: '95%' }}>
                        <span className="fa fa-home"> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '80%', display: 'inline-block' }}> { homepage } </span> </span>
                    </a>
                : '' }

                { repository ?
                    <a href={ repository.url } className="btn text-left" style={{ margin: '10px 0', padding: '1% 2%', width: '95%' }}>
                        <span className="fa fa-github"> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '80%', display: 'inline-block' }}> { repository.url } </span> </span>
                    </a>
                : '' }

                { bugs ?
                    <a href={ bugs.url } className="btn text-left" style={{ margin: '10px 0', padding: '1% 2%', width: '95%' }}>
                        <span className="fa fa-bug"> <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '80%', display: 'inline-block' }}> { bugs.url } </span> </span>
                    </a>
                : '' }

                { time ?
                    <div>
                        <p style={{ fontWeight: '300', fontSize: '28px', margin: '0', borderBottom: '1px solid #e9e9e9' }}> Version Release (<small>{ averageReleaseInDays } day avg </small>) </p>
                        <div style={{ padding: '10px 0' }}>
                            <LineChart width={ (window.innerWidth * .80) * (5 / 12) } height={ 250 } data={ versionReleases }
                              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <Tooltip formatter={self.timeFormatter} />
                              <Line type="monotone" dataKey="version" stroke="#8884d8" />
                              <Line type="monotone" dataKey="time" stroke="#82ca9d" />
                            </LineChart>
                        </div>
                    </div>
                : '' }

                { contributors ?
                    <div>
                        <p style={{ fontWeight: '300', fontSize: '28px', margin: '0', borderBottom: '1px solid #e9e9e9' }}> Contributors </p>
                        <ul>
                            { contributors.map((contrib, i) => <li key={ i }> { contrib.name } </li>) }
                        </ul>
                    </div>
                : '' }

                { maintainers ?
                    <div>
                        <p style={{ fontWeight: '300', fontSize: '28px', margin: '0', borderBottom: '1px solid #e9e9e9' }}> Maintainers </p>
                        <ul>
                            { maintainers.map((contrib, i) => <li key={ i }> { contrib.name } </li>) }
                        </ul>
                    </div>
                : '' }
            </div>
        </div>
    )
  }
}

Package.propTypes = {
    params: PropTypes.shape({
        name: PropTypes.string
    })
}

export default Package;
