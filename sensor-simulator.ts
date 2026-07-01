const URL2 = "http://localhost:3000/sensor";

function random(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

async function sendData() {

  const data = {
    temperature: random(18, 26),
    light_level: random(0, 100),
    people_count: Math.floor(random(0, 30)),
    computers_on: Math.floor(random(0, 20)),
    power_consumption: random(200, 2000)
  };

  await fetch(URL2, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });

  console.log("Sent:", data);
}

setInterval(sendData, 2000);