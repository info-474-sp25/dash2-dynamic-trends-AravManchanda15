const margin = { top: 50, right: 30, bottom: 60, left: 70 };
const width  = 900 - margin.left - margin.right;
const height = 400 - margin.top  - margin.bottom;

const svg = d3.select("#lineChart1")
    .attr("width",  width  + margin.left + margin.right)
    .attr("height", height + margin.top  + margin.bottom)
  .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

d3.csv("aircraft_incidents.csv").then(data => {
  // parse and clean
  data.forEach(d => {
    d.Event_Date = new Date(d.Event_Date);
    d.Year       = d.Event_Date.getFullYear();
    d.Location   = d.Location ? d.Location.trim() : "";
  });

  // log unique, non-blank locations
  const uniqueLocations = Array.from(
    new Set(data.map(d => d.Location).filter(loc => loc !== ""))
  );
  console.log("Distinct locations:", uniqueLocations.length);
  console.log("List of locations:", uniqueLocations);

  // group by location & year, count incidents
  const nested = d3.rollup(
    data.filter(d => d.Location !== ""),
    v => v.length,
    d => d.Location,
    d => d.Year
  );

  const locationData = Array.from(nested, ([location, yearMap]) => ({
    location,
    values: Array.from(yearMap, ([year, count]) => ({ year: +year, count }))
                   .sort((a, b) => a.year - b.year)
  }));

  // pick top 25 by total incidents
  const top25 = locationData
    .map(d => ({ ...d, total: d3.sum(d.values, v => v.count) }))
    .sort((a, b) => d3.descending(a.total, b.total))
    .slice(0, 25);

  // build dropdown
  const dropdown = d3.select("#locationDropdown");
  dropdown.selectAll("option").remove();
  dropdown.append("option").attr("value", "ALL").text("All Locations");
  top25.forEach(loc => {
    dropdown.append("option")
      .attr("value", loc.location)
      .text(loc.location);
  });

  // overall year counts for "ALL"
  const years = [...new Set(data.map(d => d.Year))].sort();
  const allYearCounts = years.map(year => ({
    year,
    count: data.filter(d => d.Year === year).length
  }));

  // scales
  const xScale = d3.scaleLinear()
    .domain(d3.extent(allYearCounts, d => d.year))
    .range([0, width]);
  const yScale = d3.scaleLinear()
    .domain([0, d3.max(allYearCounts, d => d.count)])
    .range([height, 0]);

  // axes
  svg.append("g")
      .attr("transform", `translate(0, ${height})`)
      .attr("class", "x-axis")
      .call(d3.axisBottom(xScale).tickFormat(d3.format("d")));
  svg.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale));

  // axis labels
  svg.append("text")
      .attr("x", width / 2)
      .attr("y", height + 40)
      .attr("text-anchor", "middle")
      .attr("class", "axis-label")
      .text("Year");
  svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", -50)
      .attr("x", -height / 2)
      .attr("text-anchor", "middle")
      .attr("class", "axis-label")
      .text("Number of Incidents");

  // chart title
  svg.append("text")
      .attr("class", "chart-title")
      .attr("x", width / 2)
      .attr("y", -margin.top / 2)
      .attr("text-anchor", "middle")
      .text("Aircraft Incidents Over Time");

  // line generator & initial path
  const line = d3.line()
      .x(d => xScale(d.year))
      .y(d => yScale(d.count));
  const linePath = svg.append("path")
      .datum(allYearCounts)
      .attr("fill", "none")
      .attr("stroke", "#007ACC")
      .attr("stroke-width", 2)
      .attr("d", line);

  // update on dropdown change
  dropdown.on("change", function () {
    const sel = this.value;
    const newData = sel === "ALL"
      ? allYearCounts
      : (top25.find(d => d.location === sel) || { values: [] }).values;

    yScale.domain([0, d3.max(newData, d => d.count) || 0]);
    svg.select(".y-axis")
       .transition().duration(500)
       .call(d3.axisLeft(yScale));

    linePath.datum(newData)
      .transition().duration(500)
      .attr("d", line);
  });
});
