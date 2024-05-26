const express = require('express')
const app = express()

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const bcrypt = require('bcrypt')
const path = require('path')
const jwt = require('jsonwebtoken')
const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

module.exports = app
app.use(express.json())

let db = null
const initlizeDBAndServer = async () => {
  try {
    db = await open({filename: dbPath, driver: sqlite3.Database})
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}
initlizeDBAndServer()

const convertDBResponseToObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}
const authenticationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization'] //Debugging done here , Check spelling mistakes this, authorization actual value, but you written in  Authentication
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userDetails = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(userDetails)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const validatePassword = await bcrypt.compare(password, dbUser.password)
    if (validatePassword === false) {
      response.status(400)
      response.send('Invalid password')
    } else {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    }
  }
})

app.get('/states/', authenticationToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state;`
  const dbRespone = await db.all(getStatesQuery)
  response.send(
    dbRespone.map(statesDetails => ({
      stateId: statesDetails.state_id,
      stateName: statesDetails.state_name,
      population: statesDetails.population,
    })),
  )
})

app.get('/states/:stateId/', authenticationToken, async (request, response) => {
  const {stateId} = request.params
  const getStateDetailsQuery = `SELECT * FROM state
  WHERE 
  state_id = ${stateId};`
  const stateDetailsResponse = await db.get(getStateDetailsQuery)
  response.send(convertDBResponseToObject(stateDetailsResponse))
})

app.post('/districts/', authenticationToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const districtUpdateQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)
  VALUES ('${districtName}',${stateId},${cases},${cured},${active},${deaths});`
  await db.run(districtUpdateQuery)
  response.send('District Successfully Added')
})

app.get(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictDetails = `SELECT * FROM district 
  WHERE 
  district_id=${districtId};`
    const dbDistrictResponse = await db.get(getDistrictDetails)
    console.log(dbDistrictResponse)
    response.send({
      districtId: dbDistrictResponse.district_id,
      districtName: dbDistrictResponse.district_name,
      stateId: dbDistrictResponse.state_id,
      cases: dbDistrictResponse.cases,
      cured: dbDistrictResponse.cured,
      active: dbDistrictResponse.active,
      deaths: dbDistrictResponse.deaths,
    })
  },
)

app.delete(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrict = `DELETE FROM district 
  WHERE district_id = ${districtId};`
    await db.run(deleteDistrict)
    response.send('District Removed')
  },
)

app.put(
  '/districts/:districtId/',
  authenticationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const updateQuery = `UPDATE district
  SET 
  district_name='${districtName}',
  state_id=${stateId},
  cases=${cases},
  cured=${cured},
  active=${active},
  deaths=${deaths}
  WHERE 
  district_id=${districtId};`
    await db.run(updateQuery)
    response.send('District Details Updated')
  },
)

app.get(
  '/states/:stateId/stats/',
  authenticationToken,
  async (request, response) => {
    const {stateId} = request.params
    const statsQueryDeatils = `SELECT 
  SUM(cases) AS totalCases, 
  SUM(cured) AS totalCured,
  SUM(active) AS totalActive,
  SUM(deaths) AS totalDeaths 
  FROM 
  state INNER JOIN district ON 
  state.state_id = district.state_id
  WHERE 
  district.state_id = ${stateId};`
    const statsDbResponse = await db.get(statsQueryDeatils)
    response.send(statsDbResponse)
  },
)
