//postgis-preview
//A super simple node app + leaflet frontend for quickly viewing PostGIS query results

//dependencies
var express = require('express'),
    pgp = require('pg-promise')(),
    dbgeo = require('dbgeo'),
    pg = require('pg'),
    QueryStream = require('pg-query-stream'),
    JSONStream = require('JSONStream'),
    jsonexport = require('jsonexport'),
    stream = require('stream'),
    Pool = require('pg-pool'),
    wkx = require('wkx'),
    topojson = require('topojson'),
    Buffer = require('buffer').Buffer;
    url = require('url');
    require('dotenv').config();

//If a Database url is set it will use it, else it will use other variables
if(process.env.DATABASE_URL){
    const params = url.parse(process.env.DATABASE_URL);
    const auth = params.auth.split(':');
    var port = params.port || 4000;
    var poolConfigTest = {max: 5, min: 1, 
            database: params.pathname.split('/')[1],
            user: auth[0],
            host: params.hostname};
} else {
    var port = process.env.PGPORT || 4000;
    var poolConfig = {max: 5, min: 1, 
            database: process.env.PGDATABASE,
            user: process.env.PGUSER,
            host: process.env.PGHOST || 'localhost'};
};
var app = express(),
    pool = new Pool(poolConfig);

app.use(express.static(__dirname + '/public'));

app.get('/sql', (req, res) => {
    var sql = req.query.q;
    var format = req.query.format || 'topojson';
    console.log('Executing SQL: ' + sql, format);
    res.set('Content-Type', 'text/plain');
    pool.connect(function(err, client, release){        // get a connection from the pool
        if(err) {
            console.log(err);
            var msg = err.message || err;
            console.log("ERROR:", msg);
            res.send({
                error: msg
            });
            client.release();
        }
        query = client.query(sql);
        // run the query
        var count = 0;
        query.on('row', row => {                        // process the rows to json array
            if (row['geom']){
                var wkbBuffer = new Buffer(row['geom'], 'hex');
                wkbBufferRow = wkx.Geometry.parse(wkbBuffer).toGeoJSON();
                topologyRow  = topojson.topology({output: wkbBufferRow});
                presimplifyRow = topojson.presimplify(topologyRow);
                row['geom'] = topojson.simplify(presimplifyRow); //No effect on point or multipoint 
            }
            res.write(count == 0 ? '[\n' : ',\n');
            res.write(JSON.stringify(row));
            count += 1;
        });
        query.on('end', results => {
            console.log('release');
            res.write(']\n');                            // close the array
            res.end();                                   // close the response
            client.release();                            // return the db connection
        });
        query.catch(err => {
            console.log(err);
            var msg = err.message || err;
            console.log("ERROR:", msg);
            res.send({
                error: msg
            });
            client.release();
        });
    });
});

//start the server
app.listen(port);
console.log('postgis-preview is listening on port ' + port + '...');