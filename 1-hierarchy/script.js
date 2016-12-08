/**
 * Created by siqi on 11/14/16.
 */

var m = {t:50,r:80,b:50,l:80},
    w = document.getElementById('canvas').clientWidth - m.l - m.r,
    h = document.getElementById('canvas').clientHeight - m.t - m.b;

var plot = d3.select('.canvas')
    .append('svg')
    .attr('width', w + m.l + m.r)
    .attr('height', h + m.t + m.b)
    .append('g').attr('class','plot')
    .attr('transform','translate('+ m.l+','+ m.t+')')
    .append('g').attr('class','all-nodes');

//Control element
var controlW = document.getElementById('control').clientWidth - m.l - m.r,
    controlH = document.getElementById('control').clientHeight;

var control = d3.select('.control')
    .append('svg')
    .attr('width',controlW + m.l + m.r)
    .attr('height',controlH)
    .append('g')
    .attr('transform','translate('+m.l+')');

var MAX_SIZE = 220;
var scaleSize = d3.scaleSqrt().range([0,MAX_SIZE]),
    scaleColorByMedal = d3.scaleOrdinal().range(['yellow','white','rgb(246,159,19)']).domain(['Gold','Silver','Bronze']);

//Global data object
var medalsByYearByNoc;

//import data
d3.csv('../data/Summer Olympic medallists 1896 to 2008.csv',parse,dataloaded);

function dataloaded(err,rows){
    //Data transformation
    //Nest by year, then by NOC;
    //For each NOC, compute total medal haul and nest medals by type
    var byType = d3.nest()
        .key(function(d){return d.medal});

    var pack = d3.pack();

    medalsByYearByNoc = d3.nest()
        .key(function(d){return d.edition})
        .key(function(d){return d.noc})
        .rollup(function(leaves){
            return {
                total: leaves.length,
                allMedals: pack(d3.hierarchy(
                        {key:'root', values:byType.entries(leaves)}, function(d){return d.values}
                    )
                    .sum(function(d){return d.medal?1:0; })) //a hierarchy root object, to be used later for hierarchical layout
            }
        })
        .map(rows,d3.map);

    console.log(medalsByYearByNoc);


    //Data discovery
    //Biggest medal haul?
    var maxMedalByNoc = d3.max(medalsByYearByNoc.values(), function(d){
        //d--> map of all Noc's
        return d3.max(d.values(),function(noc){
            return noc.total;
        });
    });

    scaleSize.domain([0,maxMedalByNoc]);


    //Years?
    var years = medalsByYearByNoc.keys();

    //SET UP BRUSH
    timeSlider(years);

    //DRAW GRAPHIC
    draw(medalsByYearByNoc.get(years[0]));
}

function timeSlider(years){
    //Set up an x axis for time
    var scaleX = d3.scaleLinear().domain([+years[0], +years[years.length-1]]).range([0,controlW]).clamp(true);
        axisX = d3.axisBottom()
            .scale(scaleX)
            .tickFormat(d3.format(''))
            .tickSizeOuter(0)
            .tickSizeInner(0)
            .tickPadding(15)
            .tickValues(years.map(function(y){return +y}));

    var axisX = control.append('g').attr('class','axis')
        .attr('transform','translate(0,'+controlH/2+')')
        .call(axisX);

    //Customize x axis appearance
    var AXIS_WIDTH = 8;

    axisX.selectAll('.tick').selectAll('text')
        .attr('text-anchor','start')
        .attr('transform','rotate(45)translate(5)');

    axisX.append('line')
        .attr('class','domain-offset')
        .attr('x1',0).attr('x2',controlW)
        .style('stroke-linecap','round')
        .style('stroke-width',AXIS_WIDTH)
        .select(function(){ return this.parentNode.appendChild(this.cloneNode(true))})
        .attr('class','domain-overlay')
        .style('stroke-width',AXIS_WIDTH-2);

    //Refer to this d3 slider example
    //https://bl.ocks.org/mbostock/6452972
    //Apply drag behavior
    var drag = d3.drag()
        .on('start drag end', function(){ 
            handle.attr('cx', scaleX(scaleX.invert(d3.event.x)));
        })
        .on('end', function(){
            //Index of the right-hand side insertion point
            var v = scaleX.invert(d3.event.x),
                index = d3.bisect(years, v);

            if(years[index-1]){
                index = (years[index]-v)>=(v-years[index-1])?(index-1):index;
            }

            //Position the handle
            handle.attr('cx', scaleX(years[index]));

            //Highlight the appropriate tick mark
            axisX.selectAll('.tick')
                .classed('selected',false)
                .filter(function(d,i){return i==index})
                .classed('selected',true);

            draw(medalsByYearByNoc.get(years[index]));
        })

    //Add slider element
    var handle = axisX.append('circle').attr('class','handle')
        .attr('r',AXIS_WIDTH/2+2)
        .call(drag)
}

function draw(allNoc){
    /*
     * @param allNoc --> d3.map of NOC for each year
     */

    //Variables used for visual layout
    var currentX = 0, currentY = 0, nextX = 0, yOffset = 0,
        PADDING_X = 30, PADDING_Y = 50;

    //Array of all NOCs
    var data = allNoc.entries()
        .sort(function(a,b){return b.value.total - a.value.total});

    //Data binding
    var node = plot.selectAll('.node')
        .data(data,function(d){return d.key});

    //ENTER
    var nodeEnter = node.enter()
        .append('g')
        .attr('class','node');
    nodeEnter.append('circle');
    nodeEnter.append('text').attr('class','label');

    //EXIT
    node.exit().remove();

    //ENTER + UPDATE
    node.merge(nodeEnter)
        .each(reposition)
        .select('circle')
        .transition()
        .attr('r',function(d){
            return scaleSize(d.value.total);
        });
    node.merge(nodeEnter)
        .select('.label')
        .text(function(d){return d.key})
        .attr('text-anchor','middle')
        .transition()
        .attr('y',function(d){
            return d3.max([d.value.yOffset - 20, scaleSize(d.value.total)+20]);
        });

    node.transition().attr('transform',function(d){
        return 'translate('+d.value.x+','+d.value.y+')';
    });
    nodeEnter.attr('transform',function(d){
        return 'translate('+d.value.x+','+d.value.y+')';
    });

    //ENTER/EXIT/UPDATE for sub hierarchy within each node
    node.merge(nodeEnter)
        .each(function(d,i){
            var SIZE = scaleSize(d.value.total)*2-20;

            var subNode = d3.select(this)
                .selectAll('.sub-node')
                .data(
                    d.value.allMedals.descendants().filter(function(s){return s.depth>0}),
                    function(s){return s.data.key || s.data.athlete}
                ); //TODO: not unique

            subNode.exit().transition().remove();

            subNode.enter()
                .append('circle').attr('class','sub-node')
                .merge(subNode)
                .classed('medal',function(s){
                    return !s.children;
                })
                .classed('medal-class',function(s){
                    return s.children;
                })
                .attr('cx',function(s){ return SIZE*(s.x - .5)})
                .attr('cy',function(s){ return SIZE*(s.y - .5)})
                .transition()
                .attr('r',function(s){
                    return !s.children?4:(s.r*SIZE);
                })
                //medals only
                .filter(function(s){return !s.children})
                .style('fill',function(s){
                    return scaleColorByMedal(s.data.medal);
                });


        });

    node.merge(nodeEnter).on('click',function(d){console.log(d.key)});


    //Utility functions
    //position all the country nodes
    function reposition(d,i){
        currentX = nextX;
        currentX += scaleSize(d.value.total);
        nextX = currentX + scaleSize(d.value.total) + PADDING_X;

        yOffset = scaleSize(d.value.total)>yOffset?scaleSize(d.value.total):yOffset;

        //Position
        d.value.x = currentX; d.value.y = currentY + yOffset; d.value.yOffset = yOffset;

        if(nextX > w){
            nextX = 0;
            currentY += yOffset*2 + PADDING_Y;
            yOffset = 0;
        }
    }

    /*
    //zoom behavior
    //Refer to this basic example: http://bl.ocks.org/mbostock/4e3925cdc804db257a86fdef3a032a45
    var zoom = d3.zoom()
        .on('start',function(d){
            console.log('-----');
            console.log('zoom start')
            console.log(d3.event.transform)
            console.log('--')})
        .on('end',function(d){
            console.log('--')
            console.log('zoom end')
            console.log(console.log(d3.event.transform))
            console.log('-----')})
        .on('zoom', zoomed);

    function zoomed(){
        //d3.event.transform is a zoomTransform function
        console.log(d3.event.transform.x, d3.event.transform.y, d3.event.transform.k);
        plot.attr('transform',d3.event.transform);
    }

    d3.select('.canvas').select('svg')
        .append('rect') //append a "cover" rect to capture zoom events, not ideal!
        .attr('width',w + m.l + m.r).attr('height',h + m.t + m.b)
        .style('fill','none')
        .style('pointer-events','all')
        .call(zoom);

    d3.select('body')
        .on('click',function(){
            //programmatically reset zoom transform to identity 
            console.log('Reset zoom to default!!');
            plot.transition().duration(500).call(zoom.transform,d3.zoomIdentity.translate(m.l,m.t));
        })
        .on('dbclick',function(){
            //disable dbclick
            d3.event.preventDefault();
        });
    */

    var zoom = d3.zoom()
        .on('start',function(){ console.log('zoom start'); })
        .on('end', function(){ console.log('zoom end'); })
        .on('zoom', function(){
            plot.attr('transform',d3.event.transform);

            /*
            plot.selectAll('.medal')
                .style('stroke-width', 1/d3.event.transform.k + 'px');*/
        });

    //resetZoom();

    plot.selectAll('.node')
        .on('click',function(d){
            d3.event.stopPropagation();

            var x = d.value.x,
                y = d.value.y,
                size = scaleSize(d.value.total);

            plot.transition().duration(500).call(zoom.transform, 
                d3.zoomIdentity.translate(w/2,h/2)
                    .scale(h/size/2)
                    .translate(-x,-y));
        });
    d3.select('.canvas').on('click', resetZoom);


    function resetZoom(){
        plot.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    }


}

function parse(d){
    return {
        city:d.City,
        edition:+d.Edition,
        sport:d.Sport,
        discipline:d.Discipline,
        event:d.Event,
        athlete:d.Discipline,
        noc:d.NOC,
        gender:d.Gender,
        medal:d.Medal,
        eventGender:d.Event_gender
    }
}