const express = require('express');
const path = require('path');
const { initDB, getAllCars, getCarById, createCar, updateCar, deleteCar } = require('./db');

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/cars', (req, res) => {
  try {
    const cars = getAllCars();
    res.json(cars);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/cars/:id', (req, res) => {
  try {
    const car = getCarById(Number(req.params.id));
    if (!car) return res.status(404).json({ error: 'Not found' });
    res.json(car);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cars', (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const id = createCar(req.body);
    const car = getCarById(id);
    res.status(201).json(car);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cars/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = getCarById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    updateCar(id, req.body);
    res.json(getCarById(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cars/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = getCarById(id);
    if (!existing) return res.status(404).json({ error: 'Not found' });
    deleteCar(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Car Tracker running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
