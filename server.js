const fs = require('fs')
const bodyParser = require('body-parser')
const jsonServer = require('json-server')
const jwt = require('jsonwebtoken')

const server = jsonServer.create()
const router = jsonServer.router('./database.json')
const userdb = JSON.parse(fs.readFileSync('./users.json', 'UTF-8'))
const db = JSON.parse(fs.readFileSync('./database.json', 'UTF-8'))


server.use(bodyParser.urlencoded({ extended: true }))
server.use(bodyParser.json())
server.use(jsonServer.defaults());

const SECRET_KEY = '123456789'

const expiresIn = '1h'

// Create a token from a payload 
function createToken(payload) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn })
}

// Verify the token 
function verifyToken(token) {
  return jwt.verify(token, SECRET_KEY, (err, decode) => decode !== undefined ? decode : err)
}

// Check if the user exists in database
function isAuthenticated({ email, password }) {
  return userdb.users.findIndex(user => user.email === email && user.password === password) !== -1
}

// Register New User
server.post('/auth/register', (req, res) => {
  console.log("register endpoint called; request body:");
  console.log(req.body);
  const { email, password } = req.body;

  if (isAuthenticated({ email, password }) === true) {
    const status = 401;
    const message = 'Email and Password already exist';
    res.status(status).json({ status, message });
    return
  }

  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401
      const message = err
      res.status(status).json({ status, message })
      return
    };

    // Get current users data
    var data = JSON.parse(data.toString());

    // Get the id of last user
    var last_item_id = data.users[data.users.length - 1].id;

    //Add new user
    data.users.push({ id: last_item_id + 1, email: email, password: password }); //add some data
    var writeData = fs.writeFile("./users.json", JSON.stringify(data), (err, result) => {  // WRITE
      if (err) {
        const status = 401
        const message = err
        res.status(status).json({ status, message })
        return
      }
    });
  });

  // Create token for new user
  const access_token = createToken({ email, password })
  console.log("Access Token:" + access_token);
  res.status(200).json({ access_token })
})

// Login to one of the users from ./users.json
server.post('/auth/login', (req, res) => {

  console.log("Hola");

  console.log("login endpoint called; request body:");
  console.log(req.body);
  const { email, password } = req.body;
  if (isAuthenticated({ email, password }) === false) {
    const status = 401
    const message = 'Incorrect email or password'
    res.status(status).json({ status, message })
    return
  }
  const access_token = createToken({ email, password })
  console.log("Access Token:" + access_token);
  res.status(200).json({ access_token })
})

server.use(/^(?!\/auth).*$/, (req, res, next) => {
  if (req.headers.authorization === undefined || req.headers.authorization.split(' ')[0] !== 'Bearer') {
    const status = 401
    const message = 'Error in authorization format'
    res.status(status).json({ status, message })
    return
  }
  try {
    let verifyTokenResult;
    verifyTokenResult = verifyToken(req.headers.authorization.split(' ')[1]);

    if (verifyTokenResult instanceof Error) {
      const status = 401
      const message = 'Access token not provided'
      res.status(status).json({ status, message })
      return
    }
    next()
  } catch (err) {
    const status = 401
    const message = 'Error access_token is revoked'
    res.status(status).json({ status, message })
  }
});


server.get('/affiliates', (req, res) => {

  let params = req.originalUrl.split("?");
  params = params.slice(1);
  params = params[0].split("&");

  console.log(params)

  let orderParams = {
    orderByValue: params[0].split('=')[1],
    orderDirection: params[1].split('=')[1],
    search: params[2].split('=')[1]
  }

  console.log(orderParams.search);

  let affiliates = db.affiliates;
  let rows = affiliates.rows
  let columns = affiliates.columns;

  if (orderParams.orderByValue !== undefined || orderParams.orderDirection !== undefined) {
    if (orderParams.orderDirection === 'asc') {
      rows.sort(function (a, b) {
        if (a[orderParams.orderByValue] < b[orderParams.orderByValue]) {
          return -1;
        }
        if (a[orderParams.orderByValue] > b[orderParams.orderByValue]) {
          return 1;
        }
        return 0;
      });
    } else if (orderParams.orderDirection === 'desc') {
      rows.sort(function (a, b) {
        if (a[orderParams.orderByValue] > b[orderParams.orderByValue]) {
          return -1;
        }
        if (a[orderParams.orderByValue] < b[orderParams.orderByValue]) {
          return 1;
        }
        return 0;
      });
    } else {
      // Si el parámetro "orden" no es válido, no se realiza ninguna acción.
      console.error('El parámetro "orden" debe ser "ascendente" o "descendente".');
    }
  }

  if(orderParams.search !== "undefined" ) {
    let search = orderParams.search.split('%20').join(' ');
    rows = rows.filter(row => (row.name.includes(search) || row.nroLegajo === parseInt(search)) );
  }

  res.json({ rows, columns })

});

server.use(router)

server.listen(8000, () => {
  console.log('Run Auth API Server')
})