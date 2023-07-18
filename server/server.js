// NODE CONFIG
const express = require("express");
const cors = require("cors");
const sqlite3 = require('sqlite3').verbose();
const port = 5001;
const app = express();

// WebSocket CONFIG
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });

//PUPPETEER CONFIG
const puppeteer = require('puppeteer');
const DataLayer = require('puppeteer-datalayer');

//puppeteer error fix
const launchOptions = {
  headless: "new"
};

//DB Config
let tables = ['containers'];

let db = new sqlite3.Database('server/database.db', (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Connected to the in-memory SQlite database.');
});

let data = {};

app.use(cors());
app.use(express.json());

const server = app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});

//WEBSOCKETS
wss.on('connection', ws => {
  ws.on('message', message => {
    console.log(`Received message => ${message}`);
  });
});

wss.onclose = event => {
  console.log(`WebSocket closed with code ${event.code}`);
};

wss.onerror = error => {
  console.error(`WebSocket error: ${error}`);
};

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request);
  });
});

//ROUTES
app.get("/api", (req, res) => {
  res.send(data);
});

//WHEN FORM SUBMITTED
app.post("/api", async (req, res) => {

  res.json({ message: req.body });
  
  let arr = [''];

  if(req.body.text.length < 1) {
    arr = [''];
  } else {
    arr = req.body.text.split('\n');
  }

  await scanLinks(arr);
  
});

//FUNCTIONS
async function scanLinks(arr) {

  data = {};

  if(arr != undefined) {
    // Use Promise.all to wait for all checkLink operations to complete
    const results = await Promise.all(arr.map(async (link, i) => {
      let result = "";

      if(link != undefined && link.length > 1) {
        result = await checkLink(link);  
      } else {
        result = "";
      }
      
      //Catch if array undefined 
      if(Array.isArray(result)) {
        result = result.sort();
      }

      return {
        1: link,
        2: JSON.stringify(result),
      };
    }));

    // Update data after all checkLink operations are complete
    results.forEach((result, i) => {
      data[i] = result;
    });
  }

  // After scanning links and the file is updated, notify WebSocket clients
  console.log(`Total clients: ${wss.clients.size}`); // Log total number of connected clients

  wss.clients.forEach((client, i) => {
    console.log(`Client ${i}:`, client.readyState); // Log the readyState of each client

    if (client.readyState === WebSocket.OPEN) {
      console.log(`Sending 'update' to client ${i}`);
      client.send('update');
    }
  });
  
}


//SQL instead of json
// dbClearTable(tables[0]);
// dbInsert(tables[0], data);

async function checkLink(link) {
  try {
    const browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.goto(link, { waitUntil: 'networkidle0', timeout: 60000 });

    await page.mouse.click(100, 200);

    const dataLayer = new DataLayer(page);
    const containerIDs = await dataLayer.getContainerIDs();
    const history = await dataLayer.history;

    await browser.close();

    return containerIDs;

  } catch (error) {
    console.error('An error occurred:', error);
    if (error instanceof puppeteer.errors.TimeoutError) {
      return ['timeout'];
    }
  }
}

//SQL
//CLEAR DB
function dbClear(tables) {
  tables.forEach(name => {
    // console.log(name);
    db.run("DROP TABLE IF EXISTS " + name, (err) => {
      if (err) {
        console.error(err.message);
      }
      console.log("Table `"+name+"` has been cleared");
    });
  });
}

function dbCreateTable(tables) {
  tables.forEach(name => {
    db.run('CREATE TABLE ' + name + ' (id INTEGER PRIMARY KEY, url TEXT, cont TEXT)');
  });
}

function dbInsert(table, values) {
  Object.keys(values).forEach(key => {
    db.run(`INSERT INTO ${table} (id, url, cont) VALUES(?, ?, ?)`, [key, values[key][1], values[key][2]], function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log(`A row has been inserted with rowid ${this.lastID}`);
    });
  });
}

function dbAdd(table, values) {
  Object.keys(values).forEach(key => {
    db.run(`INSERT INTO ${table} (url, cont) VALUES(?, ?)`, [values[key][1], values[key][2]], function(err) {
      if (err) {
        return console.error(err.message);
      }
      console.log(`A new row has been inserted with rowid ${this.lastID}`);
    });
  });
}

function dbSelect(table) {
  db.each('SELECT * FROM ' + table, (err, row) => {
    if (err) {
      console.error(err.message);
    }
    console.log(row);
  });
}

function dbClearTable(table) {
  db.run(`DELETE FROM ${table}`, (err) => {
    if (err) {
      console.error(err.message);
    }
    console.log(`Data from table ${table} has been cleared`);
  });
}

function dbClose() {
  // Close the database connection
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Close the database connection.');
  });
}

db.serialize(() => {
  // dbClear(tables);
  // dbCreateTable(tables);
  // dbInsert(tables[0], tableVal);
  // dbSelect(tables[0]);
  // dbClose();
});