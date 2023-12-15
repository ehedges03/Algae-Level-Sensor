// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const Chart = require("chart.js/auto");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

let chart = null;
let portRefreshTimeout = null;
let connectedPort = null;
const portSelector = document.getElementById("port-selector");
const vOverTimeChart = document.getElementById("v-over-time-chart");
const refreshPortsButton = document.getElementById("refresh-ports-button");
const sensor1DataContainer = document.getElementById("sensor-1-data");
const sensor2DataContainer = document.getElementById("sensor-2-data");
const COUNT = 250;

window.addEventListener("keydown", (e) => {
  if (["c", "C"].includes(e.key)) {
    if (chart) {
      chart.data.datasets[0].data = new Array(COUNT).fill(0);
      chart.data.datasets[1].data = new Array(COUNT).fill(0);
    }
  }
});

sensor1DataContainer.addEventListener("click", () => {
  if (!chart) return;
  const hidden = chart.data.datasets[0].hidden;
  if (!hidden) {
    sensor1DataContainer.style =
      "margin: 1rem; border-radius: 1rem; padding: .25rem; border: solid .25rem #555; background-color: #ccc; cursor: pointer;";
  } else {
    sensor1DataContainer.style =
      "margin: 1rem; border-radius: 1rem; padding: .25rem; border: solid .25rem #6ba3ea; background-color: #b4d0f5; cursor: pointer;";
  }

  chart.data.datasets[0].hidden = !hidden;
  chart.update();
});

sensor2DataContainer.addEventListener("click", () => {
  if (!chart) return;
  const hidden = chart.data.datasets[1].hidden;
  if (!hidden) {
    sensor2DataContainer.style =
      "margin: 1rem; border-radius: 1rem; padding: .25rem; border: solid .25rem #555; background-color: #ccc; cursor: pointer;";
  } else {
    sensor2DataContainer.style =
      "margin: 1rem; border-radius: 1rem; padding: .25rem; border: solid .25rem #dd6281; background-color: #eeb0c0; cursor: pointer;";
  }

  chart.data.datasets[1].hidden = !hidden;
  chart.update();
});

portSelector.addEventListener("change", (e) => {
  console.log("portSelector change", e.target.value);
});

refreshPortsButton.addEventListener("click", async () => {
  updatePortSelector();
});

let port = null;
let parser = null;

let count = 0;

const sensor1 = new Array(COUNT).fill(0);
let avg1 = 0;
let sense1 = 0;

const sensor2 = new Array(COUNT).fill(0);
let avg2 = 0;
let sense2 = 0;

async function createChart() {
  chart = new Chart(vOverTimeChart, {
    type: "line",
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          ticks: {
            font: {
              size: 16,
            },
          },
          title: { display: true, text: "Voltage (V)", font: { size: 16 } },
          beginAtZero: true,
        },
        x: {
          ticks: {
            font: {
              size: 16,
            },
          },
          title: { display: true, text: "Time (s)", font: { size: 16 } },
        },
      },
    },
    data: {
      labels: new Array(COUNT).fill(0).map((_, i) => i - COUNT - 1),
      datasets: [
        {
          label: "Sensor 1",
          data: sensor1,
          fill: true,
        },
        {
          label: "Sensor 2",
          data: sensor2,
          fill: true,
        },
      ],
    },
  });

  setInterval(() => {
    if (count >= COUNT) {
      avg1 -= chart.data.datasets[0].data[0] / COUNT;
      avg1 += sense1 / COUNT;
      avg2 -= chart.data.datasets[1].data[0] / COUNT;
      avg2 += sense2 / COUNT;
    } else {
      avg1 = 0;
      avg2 = 0;
      for (let i = COUNT - 1; i >= COUNT - count; i--) {
        avg1 += chart.data.datasets[0].data[i];
        avg2 += chart.data.datasets[1].data[i];
      }
      avg1 += sense1;
      avg2 += sense2;
      count++;
      avg1 /= count;
      avg2 /= count;
    }

    document.getElementById("avg-voltage-1").innerText = avg1.toFixed(3);
    document.getElementById("avg-voltage-2").innerText = avg2.toFixed(3);
    chart.data.datasets[0].data.push(sense1);
    chart.data.datasets[0].data.shift();
    chart.data.datasets[1].data.push(sense2);
    chart.data.datasets[1].data.shift();
    chart.update();
  }, 1000);
}

function updatePortSelector() {
  spinRefreshButton();
  clearTimeout(portRefreshTimeout);
  SerialPort.list().then((ports) => {
    ports = ports.filter((port) => port.vendorId === "2341");
    if (ports.length === 0) {
      sense1 = 0;
      sense2 = 0;
      portSelector.innerHTML = '<option value="" disabled selected>No Arduino</option>';
      portRefreshTimeout = setTimeout(updatePortSelector, 1000);
      return;
    }

    portSelector.innerHTML = "";
    ports.forEach((port) => {
      console.log(port);
      const option = document.createElement("option");
      option.value = port.path;
      option.innerText = port.friendlyName.split(" (")[0];
      portSelector.appendChild(option);
    });

    // Get selected port
    const selectedPort = portSelector.value;
    if (selectedPort) {
      openPort(selectedPort);
    }
  });
}

function closePort() {
  sense1 = 0;
  sense2 = 0;

  if (port) {
    port.close();
    connectedPort = null;
    port = null;
    parser = null;
  }
}

function openPort(path) {
  if (connectedPort === path) return;
  try {
    closePort();
    port = new SerialPort({ path, baudRate: 9600 });
    console.log(port);
    parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

    port.on("error", (e) => {
      console.error(e);
      closePort();
      portRefreshTimeout = setTimeout(updatePortSelector, 1000);
    });

    parser.on("data", (data) => {
      console.log(data);
      clearTimeout(portRefreshTimeout);
      portRefreshTimeout = setTimeout(updatePortSelector, 1000);
      let value = data.split(",").map((v) => Number(v));
      if (value.length !== 2) return;
      sense1 = value[0];
      document.getElementById("voltage-1").innerText = sense1.toFixed(3);
      sense2 = value[1];
      document.getElementById("voltage-2").innerText = sense2.toFixed(3);
    });
  } catch (e) {
    console.error(e);
    closePort();
    portRefreshTimeout = setTimeout(updatePortSelector, 1000);
  }
}

function spinRefreshButton() {
  refreshPortsButton.style = "transition: all .2s; transform: rotate(360deg);";
  setTimeout(() => {
    refreshPortsButton.style = "";
  }, 200);
}

updatePortSelector();
createChart();
