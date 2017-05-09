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
    Buffer = require('buffer').Buffer;
require('dotenv').config();


//create express app and prepare db connection
var app = express(),
    port = process.env.PORT || 4000,
    connectionParams  = process.env.DATABASE_URL || {},
    db = pgp(connectionParams ),
    poolConfig = {max: 5, min: 1}
    pool = new Pool(poolConfig);

//use express static to serve up the frontend
app.use(express.static(__dirname + '/public'));


app.get('/sql', (req, res) => {
    var sql = req.query.q;
    res.set('Content-Type', 'text/plain');
    pool.connect(function(err, client, release){        // get a connection from the pool
        if(err) {
            console.log(err);
            res.write(JSON.stringify(error));
            res.end()
            client.release();
        }
        query = client.query(sql);                      // run the query
        var count = 0;
        query.on('row', row => {                        // process the rows to json array
            // delete row['geom']
            if (row['geom']){
                row['geom'] = wkx.Geometry.parse(new Buffer(row['geom'], 'hex')).toGeoJSON();
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

// app.get('/sq1', function(req, res, next){
//     var c = 0;
//     pg.connect(connectionParams, (err, client, done) => {
//         // Handle connection errors
//         if(err) {
//             done();
//             console.log(err);
//             return res.status(500).json({success: false, data: err});
//         }
//         // SQL Query > Select Data
//         const query = client.query(sql);
//         // Stream results back one row at a time
//         query.on('row', (row) => {
//             res.setHeader('Content-Type', 'application/json');
//             res.send(JSON.stringify(row));
//             c++;
//         });
//         // After all data is returned, close connection and return results
//         query.on('end', () => {
//             console.log('Chunks: ' + c);
//             // return res.send(results);
//             res.status(200).end();
//         });
//     });
// });

//     // query using pg-promise
//     db.any(any)
//         .then(function (data) { //use dbgeo to convert WKB from PostGIS into topojson
//             switch (format) {
//                 case 'csv':
//                     return jsonExport(data).then(function (data) {
//                         res.setHeader('Content-disposition', 'attachment; filename=query.csv');
//                         res.setHeader('Content-Type', 'text/csv');
//                         return data;
//                     });
//                 case 'geojson':
//                     return dbGeoParse(data, format).then(function (data) {
//                         res.setHeader('Content-disposition', 'attachment; filename=query.geojson');
//                         res.setHeader('Content-Type', 'application/json');
//                         return data;
//                     });
//                 default:
//                     return 
//             }
//         })
//         .then(function (data) {
//             return res.send(data);
//         })
//         .catch(function (err) { //send the error message if the query didn't work
//             var msg = err.message || err;
//             console.log("ERROR:", msg);
//             res.send({
//                 error: msg
//             });
//         });
// });

function dbGeoParse(){
    return through(function write(row) {
        row['geom'] = wkx.Geometry.parse(new Buffer(row['geom'], 'hex')).toGeoJSON()
        this.queue(row)
    }, function end(){
        this.queue(null);
    });
}
// function dbGeoParse(data, format) {
//     return new Promise(function (resolve, reject) {
//         dbgeo.parse(data, {
//             outputFormat: format
//         }, function (err, result) {
//             if (err) {
//                 reject(err);
//             } else {
//                 resolve(result);
//             }
//         });
//     });
// }


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
