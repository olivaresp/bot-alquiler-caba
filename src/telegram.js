import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TelegramBot {
  constructor(botToken, chatId) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.apiUrl = `https://api.telegram.org/bot${botToken}`;
    this.messageSendDelay = 4000; // 4 seconds between messages
  }

  async sendMessage(text) {
    try {
      const response = await axios.post(`${this.apiUrl}/sendMessage`, {
        chat_id: this.chatId,
        text: text,
        parse_mode: 'HTML',
      });
      return response.data;
    } catch (error) {
      console.error('Error sending message:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendPhoto(photoUrl, caption) {
    try {
      const response = await axios.post(`${this.apiUrl}/sendPhoto`, {
        chat_id: this.chatId,
        photo: photoUrl,
        caption: caption,
        parse_mode: 'HTML',
      });
      return response.data;
    } catch (error) {
      console.error('Error sending photo:', error.response?.data || error.message);
      throw error;
    }
  }

  async sendPhotoWithButton(photoUrl, caption) {
    let tempFilePath = null;
    try {
      // Descargar la imagen
      const imageResponse = await axios.get(photoUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      // Guardar imagen temporalmente
      tempFilePath = path.join(__dirname, `../temp_image_${Date.now()}.jpg`);
      fs.writeFileSync(tempFilePath, imageResponse.data);

      // Enviar foto con archivo local
      const response = await axios.post(`${this.apiUrl}/sendPhoto`, {
        chat_id: this.chatId,
        photo: fs.createReadStream(tempFilePath),
        caption: caption,
        parse_mode: 'HTML',
      }, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Error sending photo:', error.response?.data || error.message);
      throw error;
    } finally {
      // Eliminar archivo temporal
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendListingsNotification(newListings) {
    if (newListings.length === 0) {
      console.log('No new listings to send');
      return;
    }

    try {
      // Send summary message
      const summaryText = `<b>Se encontraron ${newListings.length} nuevos alquileres:</b>`;
      await this.sendMessage(summaryText);
      await this.delay(this.messageSendDelay);

      // Send message for each listing
      for (const listing of newListings) {
        try {
          const caption = this.formatListingCaption(listing);
          
          // If listing has image, send photo, otherwise send message
          if (listing.image) {
            await this.sendPhotoWithButton(listing.image, caption);
          } else {
            await this.sendMessage(caption);
          }
          
          await this.delay(this.messageSendDelay);
        } catch (error) {
          console.error(`Error sending listing ${listing.id}:`, error.message);
          // Continue with next listing even if this one fails
        }
      }

      console.log(`Sent ${newListings.length} listing notifications`);
    } catch (error) {
      console.error('Error sending listings notification:', error.message);
    }
  }

  formatListingCaption(listing) {
    const title = listing.title || 'Sin título';
    const address = listing.address || 'Dirección no disponible';
    const price = listing.price || 'Precio no disponible';
    let info = listing.info || 'No hay información adicional';
    const link = listing.link || '#';
    
    // Limit info to 150 characters
    if (info.length > 150) {
      info = info.substring(0, 147) + '...';
    }

    return `<b>${title}</b>\n${address}\n<b>${price}</b>\n\n${info}\n\n<a href="${link}">Ver Alquiler</a>`;
  }
}
