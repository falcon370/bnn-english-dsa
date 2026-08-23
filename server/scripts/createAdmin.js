require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const email = 'admin@bnn.com';
  const existing = await User.findOne({ email });
  if (existing) {
    console.log('User already exists:', existing.email, '| role:', existing.role);
    await mongoose.disconnect();
    return;
  }

  const user = await User.create({
    name: 'Admin',
    email,
    password: 'Admin@1234',
    role: 'admin',
  });

  console.log('Admin user created:', user.email, '| role:', user.role);
  await mongoose.disconnect();
})();
