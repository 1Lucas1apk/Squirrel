import { Platform } from 'react-native';

let notificationHandlerConfigured = false;

async function getNotificationsModule() {
  return import('expo-notifications');
}

async function ensureNotificationHandler() {
  if (Platform.OS === 'web' || notificationHandlerConfigured) return;
  const Notifications = await getNotificationsModule();
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

export async function requestNotificationPermissions() {
  if (Platform.OS === 'web') return false;
  const Notifications = await getNotificationsModule();
  await ensureNotificationHandler();
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function scheduleInactivityAlert() {
  if (Platform.OS === 'web') return;
  const Notifications = await getNotificationsModule();
  await ensureNotificationHandler();

  // Cancela apenas o alerta de inatividade específico (usando um ID fixo se possível, ou limpando todos se não houver conflito)
  // Como as notificações diárias são agendadas em massa, vamos apenas identificar este como um alerta de inatividade
  
  // No Expo, o mais seguro para evitar duplicidade de um alerta futuro é cancelar e reagendar.
  // Vamos usar um identificador conceitual. 
  
  // Primeiro, vamos garantir que não estamos limpando as notificações fixas de fechamento.
  // Infelizmente o Expo Notifications não permite filtrar por categoria ao cancelar facilmente sem guardar o ID.
  // Por simplicidade e segurança, vamos apenas agendar para daqui a 3 horas.
  
  await Notifications.scheduleNotificationAsync({
    identifier: "inactivity_watchdog",
    content: {
      title: "📭 Caixa parado?",
      body: "Faz 3 horas que você não registra nada. Não deixe acumular recibos!",
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3 * 60 * 60, // 3 horas
      repeats: false,
    },
  });
}

export async function scheduleDailyReminders(semanaTime: string, sabadoTime: string, hasPendingNotes: boolean) {
  if (Platform.OS === 'web') return;
  const Notifications = await getNotificationsModule();
  await ensureNotificationHandler();

  // Limpa agendamentos antigos para não duplicar
  await Notifications.cancelAllScheduledNotificationsAsync();

  const parseTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return { hour: h, minute: m };
  };

  const sem = parseTime(semanaTime);
  const sab = parseTime(sabadoTime);
  const ghostWarning = hasPendingNotes ? "\n⚠️ Você ainda tem notas pendentes!" : "";

  // Agendamento para Segunda a Sexta (Dias 1-5 no JS)
  for (let day = 1; day <= 5; day++) {
    // Preparação (-20 min)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🕒 Hora de organizar!",
        body: "Faltam 20 min para o fechamento." + ghostWarning,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: sem.hour,
        minute: sem.minute - 20 < 0 ? 0 : sem.minute - 20,
        weekday: day + 1, // JS Sunday is 1, so Mon-Fri is 2-6
        repeats: true,
      },
    });

    // Crítico (-5 min)
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🏁 Quase na hora!",
        body: "Faltam 5 min para fechar." + (hasPendingNotes ? "\nRESOLVA AS NOTAS AGORA!" : " Tudo lançado?"),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: sem.hour,
        minute: sem.minute - 5 < 0 ? 0 : sem.minute - 5,
        weekday: day + 1,
        repeats: true,
      },
    });
  }

  // Agendamento para Sábado (Dia 6 no JS, 7 no trigger)
  // Preparação
  await Notifications.scheduleNotificationAsync({
    content: { title: "🕒 Hora de organizar!", body: "Faltam 20 min para o fechamento!" + ghostWarning },
    trigger: { 
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: sab.hour, 
      minute: sab.minute - 20 < 0 ? 0 : sab.minute - 20, 
      weekday: 7, 
      repeats: true 
    },
  });

  // Crítico
  await Notifications.scheduleNotificationAsync({
    content: { title: "🏁 Quase na hora!", body: "Faltam 5 min para fechar o Sábado!" + (hasPendingNotes ? "\nRESOLVA AS NOTAS!" : "") },
    trigger: { 
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour: sab.hour, 
      minute: sab.minute - 5 < 0 ? 0 : sab.minute - 5, 
      weekday: 7, 
      repeats: true 
    },
  });
}
