/**
 * Created by siqi on 11/14/16.
 */

//Boilerplate, just setting up
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

var data = generatePoints(200);

var line = d3.line()
    .x(function(d){return d.x}).y(function(d){return d.y})
    .curve(d3.curveBasis);

var path = plot.append('path');

console.log(data);
console.log(resample(data,20));

var interpolate = d3.interpolateArray(data, resample(data,20));



//Draw either 200 points or 20 points
d3.select('#unsampled').on('click',function(){
//Draw line with 200 points
    path.datum(data)
        .transition()
        .duration(1000)
        .style('fill','none')
        .style('stroke','black')
        .style('stroke-width','2px')        
        //here we get fancy!
        //instead of transitioning using transition().attr()
        //use transition().attrTween(), passing in a factory function
        //see this: https://github.com/d3/d3-transition/blob/master/README.md#transition_attrTween
        .attrTween('d', function(datum,i){
            var currentGeometry = d3.select(this).attr('d'),
                targetGeometry = line(datum);

            //d3-interpolate-path plugin required
            //Read this: https://bocoup.com/weblog/improving-d3-path-animation
            //under the hood, it uses d3.interpolateString

            return d3.interpolatePath(currentGeometry,targetGeometry);
        })


    plot.selectAll('.point')
        .data(data)
        .enter()
        .append('circle').attr('class','point')
        .attr('transform',function(d){
            return 'translate('+d.x+','+d.y+')';
        })
        .attr('class','point')
        .attr('r',2)
        .style('stroke','white')
        .style('stroke-width','1px')
});

d3.select('#sampled').on('click',function(){
    path.datum(resample(data,20))
        .transition()
        .duration(1000)
        .attr('d',line)
        .style('fill','none')
        .style('stroke','red')
        .style('stroke-width','2px')
        //here we get fancy!
        //instead of transitioning using transition().attr()
        //use transition().attrTween(), passing in a factory function
        //see this: https://github.com/d3/d3-transition/blob/master/README.md#transition_attrTween
        .attrTween('d', function(datum,i){
            var currentGeometry = d3.select(this).attr('d'),
                targetGeometry = line(datum);

            return d3.interpolatePath(currentGeometry,targetGeometry);
        })

})



//Generate some random points
//Not super important
function generatePoints(n){
    var points = [];

    for(var i=0; i<n; i++){
        points.push({
            x:i/n*w,
            y: Math.sin(i/n*Math.PI + Math.PI/3)*h/3 + Math.cos(i/n*Math.PI*2 + Math.PI/4)*h/5 + Math.random()*h/12+ h/2
        })
    }

    return points;
}

function resample(arr, m){
    //resamples arr, of type Array, into a small array of m elements
    var histogram = d3.histogram()
        .value(function(d){return d.x})
        .thresholds(m);

    return histogram(arr).map(function(bin){
        return {
            x: (bin.x0 + bin.x1)/2,
            y: d3.mean(bin, function(d){return d.y})
        }
    });
}