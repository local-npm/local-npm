import React from 'react';
import moment from 'moment';
import PouchDB from 'pouchdb';

class Main extends React.Component {
  constructor(props) {
      super(props);

      var couchUrl = window.location.protocol + '//' + window.location.host + '/_skimdb';
      var db = new PouchDB(couchUrl, {
        auto_compaction: true
      });

      this.state = {
          db,
          packages: [],
          index: 0
      };

      this.findPackages();
  }
  findPackages() {
      const self = this;
      const { db } = this.state;
      const start = Date.now();

      db.allDocs({
          limit: 10,
          include_docs: true
      }).then(function (res) {
        self.setState({
            packages: [res],
            time: Date.now() - start
        });
      }).catch((err) => {
        console.log(err);
      });
  }
  search(e) {
      const self = this;
      const { db } = this.state;
      const name = e.target.value;

      const start = Date.now();

      // packages don't have any particular case, so fudge it
      var lc = [name.toLowerCase(), name.toLowerCase()];
      var uc = [name.toUpperCase(), name.toUpperCase()];

      // search locally and remote since we might not be synced at 100% yet
      var queryPermutations = [ lc, uc ];
      const pouches = [db];

      return Promise.all(pouches.map(function (pouch) {
        return Promise.all(queryPermutations.map(function (query) {
          var opts = {
            startkey: name,
            endkey: name + '\uffff',
            limit: 10 * 2,
            include_docs: true
          };

          return pouch.allDocs(opts).then(null, function (err) {
            return { rows: [] }; // works offline
          });
        }));
      })).then(function (resultLists) {
          self.setState({
              packages: resultLists[0],
              time: Date.now() - start
          });
      });
  }
  render() {
    const self = this;
    const { packages, index, time } = this.state;

    const count = packages.map((pack) => pack.rows.length).reduce((a, b) => { return a + b }, 0);
    const results = packages[index] && packages[index]['rows'];

    return (
        <div style={{ width:"100%" }}>
          <div style={{ padding: '20px', margin: '0 auto', width: '80%' }}>
            <input type="text" onChange={self.search.bind(this)} placeholder="Search packages (i.e. babel, webpack, react…)"/>
            <br/>
            <div style={{ 'paddingTop': '10px', 'paddingBottom': '30px' }}>
                {count} results found in packages {time}ms
            </div>
            { results && results.map((pack, i) => {
                const { doc } = pack;
                const { author, repository, license, description, homepage, tags } = doc;
                const latest = doc['dist-tags'] && doc['dist-tags']['latest'];
                const keywords = latest && doc.versions[latest].keywords;

                return (
                    <div key={ i } style={{ minHeight: '100px', borderBottom: '1px solid #e9e9e9', paddingBottom: '10px', marginBottom: '15px' }}>
                        <div style={{ marginBottom: '10px' }}>
                            <a style={{ fontSize: '28px', color: 'black', borderBottom: '1px dotted #e9e9e9' }} href={ `/_browse/package/${doc.name}` }>{doc.name}</a>
                            { license ? <span style={{ padding: '3px', display: 'inline-block', fontSize: '10px', color: '#9a9a9a', marginRight: '5px', marginLeft: '5px', borderRadius: '5px' }} className="badge"> { license } </span> : '' }
                            { latest ? <span style={{ fontWeight: 'bold', color: '#9a9a9a', fontSize: '12px' }}> { latest } </span> : '' }
                        </div>
                        <div style={{ marginTop: '10px', marginBottom: '10px' }}> { description } </div>
                        <div>
                            { homepage ? <a style={{ marginRight: '5px' }} className="fa fa-home" href={ homepage }></a> : '' }
                            { repository ? <a className="fa fa-code-fork" href={ repository.url }></a> : '' }
                            { author ? <b> { author.name } </b> : '' }
                            { latest ? <span> { moment(doc.time[latest]).fromNow() } </span> : '' }
                        </div>
                        <div style={{ marginTop: '10px' }}>
                            { keywords && keywords.length > 0 ? <span className="fa fa-tag"> <small> { keywords.slice(0, 4).join(', ') } </small> </span> : '' }
                        </div>
                    </div>
                )
            }) }
          </div>
        </div>
    );
  }
}

export default Main;
