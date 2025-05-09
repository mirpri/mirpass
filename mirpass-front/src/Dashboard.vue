<template>
  <h1>Mirpass Dashboard</h1>
  <div class="main">
    <h2>Welcome, <span>{{ username }}</span>!</h2>
    <p>Your email: <span>{{ email }}</span></p>
    <p>Signed up at: <span>{{ formattedDate }}</span></p>
    <button @click="logout">Logout</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';

const username = ref('');
const email = ref('');
const registrationDate = ref('');
const serverroot = 'http://localhost:4000';

const formattedDate = computed(() => {
  return registrationDate.value ? new Date(registrationDate.value + 'Z').toLocaleString() : '';
});

onMounted(() => {
  fetchUserInfo();
});

function fetchUserInfo() {
  fetch(serverroot + '/user-info', { credentials: 'include' })
    .then(response => {
      if (response.status === 401) {
        throw new Error('Session expired. Please log in again.');
      }
      return response.json();
    })
    .then(data => {
      username.value = data.username;
      email.value = data.email;
      registrationDate.value = data.registrationDate;
    })
    .catch(error => {
      alert(error.message);
      window.location.href = serverroot + '/?from=' + encodeURIComponent(window.location.href);
    });
}

function logout() {
  fetch(serverroot + '/logout', { method: 'POST', credentials: 'include' })
    .then(() => {
      window.location.href = serverroot + '/';
    })
    .catch(error => {
      alert('Logout error. Please try again.');
    });
}
</script>

<style>
#app{
  display: flex;
  align-items: center;
  flex-direction: column;
}
.main{
  max-width: 600px;
  width: 80vw;
}
</style>