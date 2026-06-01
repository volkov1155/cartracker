const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'cars.db');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE cars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT,
        price REAL,
        mileage INTEGER,
        year INTEGER,
        photo TEXT,
        notes TEXT,
        rating INTEGER DEFAULT 0,
        status TEXT DEFAULT 'watching',
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    saveDB();
  }
}

function saveDB() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function getAllCars() {
  const stmt = db.prepare('SELECT * FROM cars ORDER BY created_at DESC');
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function getCarById(id) {
  const stmt = db.prepare('SELECT * FROM cars WHERE id = :id');
  stmt.bind({ ':id': id });
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function createCar(car) {
  db.run(
    `INSERT INTO cars (name, url, price, mileage, year, photo, notes, rating, status)
     VALUES (:name, :url, :price, :mileage, :year, :photo, :notes, :rating, :status)`,
    {
      ':name': car.name,
      ':url': car.url || '',
      ':price': car.price || null,
      ':mileage': car.mileage || null,
      ':year': car.year || null,
      ':photo': car.photo || '',
      ':notes': car.notes || '',
      ':rating': car.rating || 0,
      ':status': car.status || 'watching',
    }
  );
  saveDB();
  const result = db.exec('SELECT last_insert_rowid() as id');
  return result[0].values[0][0];
}

function updateCar(id, car) {
  db.run(
    `UPDATE cars SET
      name = :name,
      url = :url,
      price = :price,
      mileage = :mileage,
      year = :year,
      photo = :photo,
      notes = :notes,
      rating = :rating,
      status = :status
     WHERE id = :id`,
    {
      ':id': id,
      ':name': car.name,
      ':url': car.url || '',
      ':price': car.price || null,
      ':mileage': car.mileage || null,
      ':year': car.year || null,
      ':photo': car.photo || '',
      ':notes': car.notes || '',
      ':rating': car.rating || 0,
      ':status': car.status || 'watching',
    }
  );
  saveDB();
}

function deleteCar(id) {
  db.run('DELETE FROM cars WHERE id = :id', { ':id': id });
  saveDB();
}

module.exports = { initDB, getAllCars, getCarById, createCar, updateCar, deleteCar };
