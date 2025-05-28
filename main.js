// main.js

const margin = { top: 50, right: 30, bottom: 60, left: 70 };
const width  = 900 - margin.left - margin.right;
const height = 400 - margin.top  - margin.bottom;

// 1. SETUP SVG
const svg = d3.select("#lineChart1")
  .attr("width",  width  + margin.left + margin.right)
  .attr("height", height + margin.top  + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// 2. TOOLTIP DIV
const tooltip = d3.select("body")
  .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

d3.csv("aircraft_incidents.csv").then(data => {
  // parse + clean
  data.forEach(d => {
    d.Event_Date = new Date(d.Event_Date);
    d.Year       = d.Event_Date.getFullYear();
    d.Location   = d.Location ? d.Location.trim() : "";
  });

  // roll up counts per location/year
  const nested = d3.rollup(
    data.filter(d => d.Location !== ""),
    v => v.length,
    d => d.Location,
    d => d.Year
  );
  const locationData = Array.from(nested, ([loc, ym]) => ({
    location: loc,
    values: Array.from(ym, ([year, count]) => ({ year:+year, count }))
                 .sort((a,b) => a.year - b.year)
  }));
  const top25 = locationData
    .map(d => ({ ...d, total: d3.sum(d.values, v => v.count) }))
    .sort((a,b) => d3.descending(a.total, b.total))
    .slice(0, 25);

  // build dropdown
  const dropdown = d3.select("#locationDropdown");
  dropdown.selectAll("option").remove();
  dropdown.append("option")
    .attr("value","ALL")
    .text("All Locations");
  top25.forEach(d =>
    dropdown.append("option")
      .attr("value", d.location)
      .text(d.location)
  );

  // overall per-year counts
  const years = [...new Set(data.map(d => d.Year))].sort();
  let allYearCounts = years.map(y => ({
    year: y,
    count: data.filter(d => d.Year === y).length
  }));

  // SCALES
  const xScale = d3.scaleLinear()
    .domain(d3.extent(allYearCounts, d => d.year))
    .range([0, width]);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(allYearCounts, d => d.count)])
    .range([height, 0]);

  // AXES
  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));

  svg.append("g")
    .call(d3.axisLeft(yScale).tickFormat(d3.format("d")));

  // AXIS LABELS
  svg.append("text")
    .attr("x", width/2)
    .attr("y", height + 40)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Year");

  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height/2)
    .attr("y", -50)
    .attr("text-anchor", "middle")
    .attr("class", "axis-label")
    .text("Number of Incidents");

  // LINE GENERATOR
  const lineGen = d3.line()
    .x(d => xScale(d.year))
    .y(d => yScale(d.count))
    .curve(d3.curveMonotoneX);

  // INITIAL LINE PATH
  const linePath = svg.append("path")
    .datum(allYearCounts)
    .attr("fill", "none")
    .attr("stroke", "#007ACC")
    .attr("stroke-width", 2)
    .attr("d", lineGen);

  // CIRCLES & TOOLTIP LOGIC
  function drawCircles(dataPoints) {
    svg.selectAll("circle").remove();

    svg.selectAll("circle")
      .data(dataPoints)
      .enter()
      .append("circle")
        .attr("cx", d => xScale(d.year))
        .attr("cy", d => yScale(d.count))
        .attr("r", 6)
        .attr("fill", "#007ACC")
      .on("mouseover", (event, d) => {
        tooltip.html(`Year: ${d.year}<br/>Incidents: ${d.count}`)
               .style("opacity", 0.9);
      })
      .on("mousemove", event => {
        tooltip
          .style("left",  (event.pageX + 10) + "px")
          .style("top",   (event.pageY - 28) + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });
  }

  // draw initial circles
  drawCircles(allYearCounts);

  // UPDATE on dropdown change
  dropdown.on("change", function() {
    const sel = this.value;
    const newData = sel === "ALL"
      ? allYearCounts
      : (top25.find(d => d.location === sel) || { values: [] }).values;

    // rescale Y
    yScale.domain([0, d3.max(newData, d => d.count) || 0]);
    svg.select("g.y-axis, .y-axis")
      .transition().duration(500)
      .call(d3.axisLeft(yScale).tickFormat(d3.format("d")));

    // redraw line & circles
    linePath.datum(newData)
      .transition().duration(500)
      .attr("d", lineGen);

    drawCircles(newData);
  });
});
