<template>
  <h1>Mirpass</h1>
  <div class="login-container">
    <form @submit.prevent="login" v-if="!isregistering">
      <label for="username">USERNAME</label>
      <input type="text" v-model="username" placeholder="Username" required />
      <label for="password">PASSWORD</label>
      <input type="password" v-model="password" placeholder="Password" required />
      <button type="submit">LOGIN</button>
    </form>
    <form v-if="isregistering" @submit.prevent="register">
      <label for="username">USERNAME</label>
      <input type="text" v-model="username" placeholder="Username" required />
      <label for="password">CREATE PASSWORD</label>
      <input type="password" v-model="password" placeholder="Password" required />
      <button type="submit">REGISTER</button>
    </form>
    <button v-if="!isregistering" @click="registerform">CREATE ACCOUNT</button>
    <button v-if="isregistering" @click="registerform">BACK</button>
  </div>
  <div class="bubble" id="popup-bubble"></div>
</template>

<script setup>
import { ref } from 'vue';

const username = ref('');
const password = ref('');

const login = async() => {
  console.log('Logging in with:', username.value, password.value);
  try {
    console.log('sending request');
    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await response.json();
    if (response.ok) {
      alert(data.message); // Show success message
    } else {
      alert(data.message); // Show error message
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

const register = async() => {
  console.log('Registering with:', username.value, password.value);
  try {
    console.log('sending request');
    const response = await fetch('/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: username.value, password: password.value }),
    });
    const data = await response.json();
    if (response.ok) {
      // alert(data.message); // Show success message
      const popupBubble = document.getElementById('popup-bubble');
      popupBubble.textContent = data.message;
      popupBubble.style.width= 'auto';
      setTimeout(() => {
        popupBubble.style.width= '0px';
      }, 2000);
      isregistering.value = false;
    } else {
      // alert(data.message); // Show error message
      const popupBubble = document.getElementById('popup-bubble');
      popupBubble.textContent = data.message;
      popupBubble.style.width= 'auto';
      setTimeout(() => {
        popupBubble.style.width= '0px';
      }, 2000);
    }
  } catch (error) {
    console.error('Error:', error);
  }
};

const isregistering = ref(false);
const registerform = () => {
  isregistering.value = !isregistering.value;
};

</script>

<style>
#app{
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  height: 100vh;
}
</style>
<style scoped>
.login-container {
  width: 90%;
  max-width: 500px;
  padding: 30px;
  text-align: center;
  background-color: white;
  border-radius: 20px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.1);
}
input {
  width: 100%;
  margin: 0 0 10px 0;
  padding: 10px !important;
  font-size: 16px;
  box-sizing: border-box !important;
}
form button {
  width: 100%;
  margin: 10px 0;
  padding: 10px !important;
  background-color: #4763ff;
  font-size: 18px;
  color: white;
}
form button:hover {
  background-color: #4d3dff;
  box-shadow: #004cff 0px 0px 10px;
  color: white;
}
button {
  width: 100%;
  margin: 10px 0;
  padding: 10px !important;
  border: #4763ff 1px solid;
  background-color: #fff;
  font-size: 18px;
  color: #4763ff
}
button:hover {
  background-color: #fff;
  box-shadow: #004cff 0px 0px 3px;
  color: #4763ff;
}
label{
  display: block;
  color: #999;
}
h1{
  margin-bottom: 20px;
}
</style>
