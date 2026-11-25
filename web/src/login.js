import './style.css';
import { ApiError, checkAccess } from '../../shared/client.js';
import { removeLegacyData, setAccessCode } from './storage.js';
import { $, showToast } from './ui.js';

function describeLoginError(error) {
  if (error instanceof ApiError && error.status === 401) return 'Неверный код доступа';
  if (/Invalid access code/.test(error.message)) return 'Код должен выглядеть как «токен.ключ» — скопируй его целиком';
  return `Ошибка: ${error.message}`;
}

async function handleSubmit(event) {
  event.preventDefault();
  const accessCode = $('#access-code').value.trim();
  if (!accessCode) return;
  try {
    await checkAccess({ accessCode });
    setAccessCode(accessCode);
    removeLegacyData();
    location.replace('/');
  } catch (error) {
    showToast(describeLoginError(error), 5000);
  }
}

$('#login-form').addEventListener('submit', handleSubmit);
