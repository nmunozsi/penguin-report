'use strict';
/**
 * @file Main Client app
 * @copyright Zemoga Inc
 */

/* global navigator */
/* global document */
/* global location */
/* global localStorage */
/* global fetch */

/**
 * Penguin report main App
 * @namespace PenguinReport
 */
const PenguinReport = {

  //TODO: Client side code should be switched to ES2015 by Adding a build with babel
  // in the same way it was implemented for server side code

  /**
   * Registers in the push notification
   * @return {void}
   */
  register () {
    // Applying DeMorgan's Law here to avoid nesting
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker is not supported');
      return;
    }

    let serviceWorkerRegistration;

    // Register the service worker
    // navigator.serviceWorker.register(PenguinReport.ROOT_URI + '/sw.js', {
    //   scope: PenguinReport.ROOT_URI
    // })
    // .then((registration) => {
    //   console.log('Service worker registered', registration);
    //   return navigator.serviceWorker.ready;
    // })
    // // We need the service worker registration to check for a subscription
    // .then((registration) => {
    //   console.log('Service worker ready');

    //   serviceWorkerRegistration = registration;

    //   return serviceWorkerRegistration.pushManager.subscribe({
    //     userVisibleOnly: true
    //   });
    // })
    // .then((sub) => {
    //   const endpointParts = sub.endpoint.split('/');
    //   const pushRegistry = endpointParts[endpointParts.length - 1];

    //   console.log('User authorized the notifications: ', sub.endpoint);

    //   if (localStorage.getItem(PenguinReport.STORAGE_IDENTIFIER)) {
    //     fetch(PenguinReport.ROOT_URI + '/sync-user/?user=' + localStorage.getItem(PenguinReport.STORAGE_IDENTIFIER) + '&registry=' + pushRegistry)
    //     .then((response) => {
    //       if (response.status !== 200) {
    //         // Either show a message to the user explaining the error
    //         // or enter a generic message and handle the
    //         // onnotificationclick event to direct the user to a web page
    //         console.log('Looks like there was a problem. Status Code: ' + response.status);
    //         throw new Error();
    //       }
    //       return response.json();
    //     })
    //     .then((data) => {
    //       console.log('the data', data);
    //     })
    //     .catch((err) => {
    //       console.error('Unable to retrieve data', err);
    //     });
    //   }

    //   // Do we already have a push message subscription?
    //   return serviceWorkerRegistration.pushManager.getSubscription();
    // })
    // .then((subscription) => {
    //   // Enable any UI which subscribes / unsubscribes from
    //   // push messages.
    //   console.log('the suscription', subscription);

    //   if (subscription && subscription.endpoint) {
    //     console.log('and the suscription is ', subscription.endpoint);
    //   }
    // })
    // .catch((err) => {
    //   console.warn('Error during service worker registration workflow', err);
    // });
  },

  /**
   * Initializes and request registry
   * @return {void}
   */
  init () {
    const documentElement = document.querySelector('html');
    const ENV = JSON.parse(document.querySelector('#data-env').textContent.trim());
    const zPeepsList = document.getElementById('z-peeps');
    const zPeepsIdentify = document.getElementById('z-peeps-identify');
    const pushNotifier = document.getElementById('push-notifier');

    // Adding server variables to namespace
    Object.assign(PenguinReport, ENV);

    //Send push notification to pinguined users
    pushNotifier.addEventListener('click', () => {
      pushNotifier.disabled = true;
      pushNotifier.textContent = 'Notifying...';
      fetch(PenguinReport.ROOT_URI + '/notify/' + location.search)
      .then((response) => {
        if (response.status !== 200) {
          pushNotifier.textContent = 'Error notifyng';
          console.log('Looks like there was a problem. Status Code: ' + response.status);
          throw new Error();
        }
        return response.json();
      })
      .then((data) => {
        console.log('the data', data);
        if (data.nopinguins) {
          pushNotifier.textContent = 'No people to notify!!!!';
        } else {
          if (data.failure) {
            pushNotifier.textContent = 'Notifications sent but with problems';
          } else {
            pushNotifier.textContent = 'Users notified!!!!';
          }
        }
      })
      .catch((err) => {
        pushNotifier.textContent = 'Error notifyng';
        console.error('Unable to retrieve data', err);
      });
    }, false);

    zPeepsIdentify.addEventListener('click', () => {

      const selectedPeep = zPeepsList.options[zPeepsList.selectedIndex];

      if(selectedPeep.value) {
        localStorage.setItem(PenguinReport.STORAGE_IDENTIFIER, zPeepsList.value + '|' + selectedPeep.text);
        documentElement.classList.remove('z-peeps-visible');
        PenguinReport.register();
      }
    }, false);

    if (!localStorage.getItem(PenguinReport.STORAGE_IDENTIFIER)) {
      documentElement.classList.add('z-peeps-visible');
    } else {
      PenguinReport.register();
    }
  }
};

//Initialize
//PenguinReport.init();
