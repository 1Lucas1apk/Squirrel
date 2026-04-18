import * as Notifications from 'expo-notifications';

// Configura como a notificação aparece com o app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  return finalStatus === 'granted';
}

export async function scheduleDailyReminders(semanaTime: string, sabadoTime: string, hasPendingNotes: boolean) {
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
