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
require('dotenv').config();

//create express app and prepare db connection
var app = express(),
    port = process.env.PORT || 4000,
    connectionParams  = process.env.DATABASE_URL || {},
    db = pgp(connectionParams ),
    poolConfig = {max: 5, min: 1, 
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        port: process.env.PGPORT}
    pool = new Pool(poolConfig);

//use express static to serve up the frontend
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
        };
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
            console.log('release')
            res.write(']\n')                            // close the array
            res.end()                                   // close the response
            client.release();                                  // return the db connection
        });
    });
});

function dbGeoParse(data, format) {
    return new Promise(function (resolve, reject) {
        dbgeo.parse(data, {
            outputFormat: format
        }, function (err, result) {
            if (err) {
                reject(err);
            } else {
                console.log(JSON.stringify(result))
                resolve(result);
            }
        });
    });
}

function jsonExport(data) {
    //remove geom
    data.forEach(function (row) {
        delete row.geom;
    });

    return new Promise(function (resolve, reject) {
        jsonexport(data, function (err, csv) {
            if (err) {
                reject(err);
            } else {
                resolve(csv);
            }
        });
    });
}

//start the server
app.listen(port);
console.log('postgis-preview is listening on port ' + port + '...');
