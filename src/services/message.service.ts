import { publishDirectMessage } from "@chat/queues/message.producer";
import { ConversationModel } from "@chat/models/conversation.schema";
import { MessageModel } from "@chat/models/message.schema";
import { IConversationDocument, IMessageDetails, IMessageDocument, lowerCase } from "@TunKeyy/leo-shared";
import { chatChannel, socketIOChatObject } from "@chat/server";

export const addMessage = async (messageData: IMessageDocument): Promise<IMessageDocument> => {
  const message: IMessageDocument = await MessageModel.create(messageData) as IMessageDocument;
  if (messageData.hasOffer) {
    const emailMessageDetails: IMessageDetails = {
      sender: messageData.senderUsername,
      amount: `${messageData.offer?.price}`,
      buyerUsername: lowerCase(`${messageData.receiverUsername}`),
      sellerUsername: lowerCase(`${messageData.senderUsername}`),
      title: messageData.offer?.gigTitle,
      description: messageData.offer?.description,
      deliveryDays: `${messageData.offer?.deliveryInDays}`,
      template: "offer"
    };

    await publishDirectMessage(
      chatChannel,
      "order-notification",
      "order-email",
      JSON.stringify(emailMessageDetails),
      "Order email sent to notification service"
    );
  }

  return message;
};

export const createConversation = async (conversationId: string, sender: string, receiver: string): Promise<void> => {
  await ConversationModel.create({
    conversationId,
    senderUsername: sender,
    receiverUsername: receiver
  });
};

export const getConversation = async (sender: string, receiver: string): Promise<IConversationDocument[]> => {
  const query = {
    $or: [
      { senderUsername: sender, receiverUsername: receiver },
      { senderUsername: receiver, receiverUsername: sender },
    ]
  };

  return ConversationModel.aggregate([{ $match: query }]);
};


export const getUserConversationList = async (username: string): Promise<IMessageDocument[]> => {
  const query = {
    $or: [
      { senderUsername: username },
      { receiverUsername: username },
    ]
  };
  const messages: IMessageDocument[] = await MessageModel.aggregate([
    { $match: query },
    {
      $group: {
        _id: "$conversationId",
        result: { $top: { output: "$$ROOT", sortBy: { createdAt: -1 }}}
      }
    },
    {
      $project: {
        _id: "$result._id",
        conversationId: "$result.conversationId",
        sellerId: "$result.sellerId",
        buyerId: "$result.buyerId",
        receiverUsername: "$result.receiverUsername",
        receiverPicture: "$result.receiverPicture",
        senderUsername: "$result.senderUsername",
        senderPicture: "$result.senderPicture",
        body: "$result.body",
        file: "$result.file",
        gigId: "$result.gigId",
        isRead: "$result.isRead",
        hasOffer: "$result.hasOffer",
        createdAt: "$result.createdAt"
      }
    }
  ]);
  return messages;
};

export const getMessages = async (sender: string, receiver: string): Promise<IMessageDocument[]> => {
  const query = {
    $or: [
      { senderUsername: sender, receiverUsername: receiver },
      { senderUsername: receiver, receiverUsername: sender },
    ]
  };
  const messages: IMessageDocument[] = await MessageModel.aggregate([
    { $match: query },
    { $sort: { createdAt: 1 }}
  ]);
  return messages;
};

export const getUserMessages = async (messageConversationId: string): Promise<IMessageDocument[]> => {
  const messages: IMessageDocument[] = await MessageModel.aggregate([
    { $match: { conversationId: messageConversationId } },
    { $sort: { createdAt: 1 }}
  ]);
  return messages;
};

export const updateOffer = async (messageId: string, type: string): Promise<IMessageDocument> => {
  const message: IMessageDocument = await MessageModel.findOneAndUpdate(
    { _id: messageId },
    {
      $set: {
        [`offer.${type}`]: true
      }
    },
    { new: true }
  ) as IMessageDocument;
  return message;
};

export const markMessageAsRead = async (messageId: string): Promise<IMessageDocument> => {
  const message: IMessageDocument = await MessageModel.findOneAndUpdate(
    { _id: messageId },
    {
      $set: {
        isRead: true,
      }
    },
    { new: true }
  ) as IMessageDocument;

  socketIOChatObject.emit("message updated", message);
  return message;
};

export const markManyMessagesAsRead = async (receiver: string, sender: string, messageId: string): Promise<IMessageDocument> => {
  await MessageModel.updateMany(
    { senderUsername: sender, receiverUsername: receiver, isRead: false },
    {
      $set: {
        isRead: true
      }
    },
  ) as IMessageDocument;
  const message: IMessageDocument = await MessageModel.findOne({ _id: messageId }).exec() as IMessageDocument;
  socketIOChatObject.emit("message updated", message);
  return message;
};