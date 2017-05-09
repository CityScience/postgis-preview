(function() {
    'use strict'
    //layer will be where we store the L.geoJSON we'll be drawing on the map
    var layer;
    var sql;
    var features;
    var currentLayer = 'Grayscale';
    var oldLayer;
    var overlays = {};
    //add mapBox.light tileLayers options
    var mbAttr = '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        mbUrl = 'https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg?access_token=pk.eyJ1IjoibG1veGhheSIsImEiOiJjajB0YzM0cXIwMDF6MzNtZHdyZ3J4anFhIn0.FSi3dh1eb4vVOGMtI9ONJA';
    var grayscale = L.tileLayer(mbUrl, {
            id: 'mapbox.light',
            attribution: mbAttr
        }),
        satellite = L.tileLayer(mbUrl, {
            id: 'mapbox.satellite',
            attribution: mbAttr
        }),
        dark = L.tileLayer(mbUrl, {
            id: 'mapbox.dark',
            attribution: mbAttr
        }),
        outdoors = L.tileLayer(mbUrl, {
            id: 'mapbox.outdoors',
            attribution: mbAttr
        }),
        streets = L.tileLayer(mbUrl, {
            id: 'mapbox.streets',
            attribution: mbAttr
        });

    //initialize a leaflet map
    var map = L.map('map', {
        center: [54.6128, -2.6806],
        zoom: 6,
        layers: [grayscale]
    });

    var baseLayers = {
        "Grayscale": grayscale,
        "Streets": streets,
        "Satellite": satellite,
        "Dark": dark,
        "Outdoors": outdoors
    };

    var overlays = {};
    var lcontrol = L.control.layers(baseLayers, overlays, {
        position: 'bottomleft'
    }).addTo(map);


    var queryHistory = (localStorage.history) ? JSON.parse(localStorage.history) : [];
    var historyIndex = queryHistory.length;
    updateHistoryButtons();

    //Listen for the baselayer changing
    map.on('baselayerchange', function(updatedLayer) {
        if (layer && jQuery.inArray(layer, overlays) == -1) {
            setColourForLayer(updatedLayer);
        }
        return currentLayer = updatedLayer;
    });

    //listen for submit of new query
    $('#run').click(function() {
        submitQuery();
    });

    //Only add the table when the button is clicked
    $('.dataBtn').on('click', function() {
        if (!($(".dataBtn").hasClass("active")) && features) {
            buildTable(features); //build the DataTable
        }
    });

    function submitQuery() {
        $('#notifications').hide();
        $('#download').hide();
        $('#run').addClass('active');

        clearTable();
        //Clear the layers if there are no overlays
        if (map.hasLayer(layer) && overlays.length == 0) {
            layer.clearLayers();
        }

        sql = editor.getDoc().getValue();

        addToHistory(sql);

        //pass the query to the sql api endpoint
        $.getJSON('/sql?q=' + encodeURIComponent(sql), function(data) {
            $('#run').removeClass('active');
            $('#notifications').show();
            $('#download').show();
            if (data.error !== undefined) {
                //write the error in the sidebar
                $('#notifications').removeClass().addClass('alert alert-danger');
                $('#notifications').text(data.error);
            } else if (data.length == 0) {
                $('#notifications').removeClass().addClass('alert alert-warning');
                $('#notifications').text('Your query returned no features.');
            } else {
                var features = data.map(function(obj){
                    return {
                        type:'Feature',
                        geometry : obj.geom,
                        properties : obj
                    }
                });
                var featureCount = data.length;
                var geoFeatures = features.filter(function(feature) {
                    return feature.geometry;
                });
                $('#notifications').removeClass().addClass('alert alert-success');
                if (geoFeatures.length) {
                    addLayer(geoFeatures, currentLayer); //draw the map layer
                    $('#notifications').html(featureCount + ' features returned. \nName and save query:\n'+
                    '<form class="form-inline"><input class="form-control" type="text" id="queryName" name="queryName" value="" placeholder="Query Name">'+
                    '<input class="form-control" id="colorPicker" type="color" name="favcolor"><button type="submit" class="btn btn-default">Save</button></form>');
                    $('#notifications').addClass('overlaysOption');
                } else {
                    // There is no map to display, so switch to the data view
                    $('#notifications').html(featureCount + ' features returned.<br/>No geometries returned, see the <a href="#" class="data-view">data view</a> for results.');
                    //toggle map and data view
                    $('a.data-view').click(function() {
                        $('#map').hide();
                        $('#table').show();
                    });
                }

                //only add the table if the table is set to display - Performance
                if ($(".dataBtn").hasClass("active")) {
                    buildTable(features); //build the DataTable
                }

                //Check if the layer is in the overlays array
                if (oldLayer) {
                        map.removeLayer(oldLayer);
                    };
                if (overlays.length > 0) {
                    if (overlays[overlays.length - 1]._leaflet_id !== oldLayer._leaflet_id) {
                        map.removeLayer(oldLayer);
                    }
                } else {
                    if (oldLayer) {
                        map.removeLayer(oldLayer);
                    };
                };
                if (map.hasLayer(layer)) {
                    return oldLayer = layer;
                }
            }
        });
    };


    //toggle map and data view
    $('.btn-group button').click(function(e) {
        $(this).addClass('active').siblings().removeClass('active');

        var view = $(this)[0].innerText;

        if (view == "Data View") {
            $('#map').hide();
            $('#table').show();
        } else {
            $('#map').show();
            map.invalidateSize();
            $('#table').hide();
        }
    });
    //Add query to overlays
    $(document).on('click', ".overlaysOption .btn", function(e) {
        e.preventDefault();
        //Remove previous label
        addToOverlays();
        //Remove overlay buttons 
        if ($('#remove').length == 0) {
            $('.leaflet-control-container').append($("<div id='remove' class='btn btn-info'></div>").text('Delete Overlays'));
        } else {
            $('#remove').removeClass('hide')
        };
    });

    $(document).on('click', "#remove", function() {
        $('#remove').addClass('hide');
        $.each(overlays, function(key,layer){
            layer.clearLayers();
        });
        overlays = {};
        //update the control label with the new amount of overlays
        $('.leaflet-bottom > .leaflet-control-layers:last-child').remove();
        L.control.layers(baseLayers, overlays, {
            position: 'bottomleft',
            collapsed: true
        }).addTo(map);
        //Also stop the notification being click again 
        $('#notifications').hide();
    });

    //forward and backward buttons for query history
    $('#history-previous').click(function() {
        historyIndex--;
        updateSQL(queryHistory[historyIndex]);
        updateHistoryButtons();
    });

    $('#history-next').click(function() {
        historyIndex++;
        updateSQL(queryHistory[historyIndex]);
        updateHistoryButtons();
    });

    $('#geojson').click(function() {
        var url = '/sql?q=' + encodeURIComponent(sql) + '&format=geojson';
        window.open(url, '_blank');
    });

    $('#csv').click(function() {
        var url = '/sql?q=' + encodeURIComponent(sql) + '&format=csv';
        window.open(url, '_blank');
    });

    // initialize keyboard shortcut for submit
    $(window).keydown(function(e) {
        if (e.metaKey && e.keyCode == 83) {
            // crtl/cmd+S for submit
            e.preventDefault();
            submitQuery();
            return false;
        }
    });

    //Toggle the sidebar 
    $('.closeSide').click(function() {
        $('#sidebar').toggleClass('slideIn', 300);
        //Tell the map that the parent div has resized hence the slight delay
        setTimeout(function() {
            map.invalidateSize()
        }, 300);
        $('#table').toggleClass('slideIn', 300);
    })

    function propertiesTable(properties) {
        if (!properties) {
            properties = {};
        }
        var table = $("<table><tr><th>Column</th><th>Value</th></tr></table>");
        var keys = Object.keys(properties);
        var banProperties = ['geom'];
        for (var k = 0; k < keys.length; k++) {
            if (banProperties.indexOf(keys[k]) === -1) {
                var row = $("<tr class='tableData'></tr>");
                row.append($("<td></td>").text(keys[k]));
                row.append($("<td></td>").text(properties[keys[k]]));
                table.append(row);
            }
        }
        return '<table border="1">' + table.html() + '</table>';
    }

    //Check which layer is the baselayer and then edit the layer styles
    function setColourForLayer(currentLayer) {
        switch (currentLayer.name) {
            case 'Dark':
            case 'Satellite':
                layer.setStyle({
                    color: '#fff'
                });
                break;
            case 'Streets':
            case 'Outdoors':
            default:
                layer.setStyle({
                    color: '#000'
                });
                break;
        }
    }
    var columnValue = '';
    $('#map').on('click', '.tableData', function (){
        var clickedKey = $(this).find(">:first-child").html();
        var clickedvalue = $(this).find(">:last-child").html();
        if($(this).closest('tbody').find('.selected').length > 0) {
            $(this).siblings('.selected').removeClass('selected');
        }
        $('#heatMapped').html('<div class="alert alert-info">Heatmapped by: ' + clickedKey + '</div>');
        $(this).addClass('selected');
        if($.isNumeric(clickedvalue)){
            columnValue = clickedKey;
            return columnValue;
        } else {
            return columnValue = '';
        }
    });
    //Check which layer is the baselayer and then edit the layer styles
    function addLayer(features) {
        if(columnValue != '') {
            //Color range for selected column
            var array =[];
            $.each(features, function( index, value ) {
                array.push(value['properties'][columnValue]);
                return array;
            });
            var colorScale = chroma  
                .scale(['#D5E3FF', '#003171'])
                .domain([Math.min.apply(Math,array),Math.max.apply(Math,array)]);
            }
        //create an L.geoJson layer, add it to the map
        layer = L.geoJson(features, {
            style: {
                color: '#fff', // border color
                fillColor: 'steelblue',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.7
            },
            onEachFeature: function(feature, layer) {
                if (feature.geometry.type !== 'Point') {
                    layer.bindPopup(propertiesTable(feature.properties));
                };
                if(columnValue != '') {
                var color = colorScale(feature['properties'][columnValue]).hex();
                    layer.setStyle({
                        fillColor: color
                    })
                }
            },
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: "#ff7800",
                    color: "#000",
                    weight: 1,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(propertiesTable(feature.properties));
            }
        }).addTo(map)
        setColourForLayer(currentLayer);

        map.fitBounds(layer.getBounds());
        $('#notifications').empty();
    }
    function addToOverlays() {
        if (jQuery.inArray(layer, overlays) == -1) {
            if ($('.leaflet-control-layers-list')) {
                $('.leaflet-bottom > .leaflet-control-layers:last-child').remove();
            };
            if($('#colorPicker').val() !== '#000000'){
                layer.setStyle({
                color: $('#colorPicker').val(),
                fillColor: $('#colorPicker').val()
            });
            }
            overlays[$('#queryName').val()]=layer;
            L.control.layers(baseLayers, overlays, {
                position: 'bottomleft',
                collapsed: false
            }).addTo(map);
        }
    };

    function buildTable(features) {
        //assemble a table from the geojson properties
        //Table built to keep pagination 
        var fields = Object.keys(features[0].properties);
        $('#table').append('<table id="example" class="table table-striped table-bordered" cellspacing="0">');
        $('#table > table').append('<thead><tr/></thead>');
        $('#table > table').append('<tfoot><tr/></tfoot>');
        $('#table > table').append('<tbody></tbody>');

        fields.forEach(function(field) {
            $('#table').find('thead').find('tr').append('<th>' + field + '</th>');
            $('#table').find('tfoot').find('tr').append('<th>' + field + '</th>')
        });

        features.forEach(function(feature) {
            //create tr with tds in memory
            var $tr = $('<tr/>');

            fields.forEach(function(field) {
                $tr.append('<td>' + feature.properties[field] + '</td>')
            })

            $('#table').find('tbody').append($tr);
        });

        $('#table>table').DataTable({});
    }

    function clearTable() {
        $('#table').empty();
    };

    function addToHistory(sql) {
        //only store the last 25 queries
        if (queryHistory.length > 25) {
            queryHistory.shift();
        }

        queryHistory.push(sql);
        localStorage.history = JSON.stringify(queryHistory);
        historyIndex++;
        updateHistoryButtons();
    }

    function updateSQL(sql) {
        editor.setValue(sql);
    }

    //enable and disable history buttons based on length of queryHistory and historyIndex
    function updateHistoryButtons() {
        if (historyIndex > queryHistory.length - 2) {
            $('#history-next').addClass('disabled')
        } else {
            $('#history-next').removeClass('disabled')
        }

        if (queryHistory[historyIndex - 1]) {
            $('#history-previous').removeClass('disabled')
        } else {
            $('#history-previous').addClass('disabled')
        }
    }

}());

//Load codemirror for syntax highlighting
window.onload = function() {
    window.editor = CodeMirror.fromTextArea(document.getElementById('sqlPane'), {
        mode: 'text/x-pgsql',
        indentWithTabs: true,
        smartIndent: true,
        lineNumbers: false,
        matchBrackets: true,
        autofocus: true,
        lineWrapping: true,
        theme: 'monokai'
    });
    editor.replaceRange('\n', {line: 2,ch: 0}); // create newline for editing
    editor.setCursor(2, 0);
};