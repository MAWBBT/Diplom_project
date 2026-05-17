function messageToFeedback(row) {
  const m = row.toJSON ? row.toJSON() : row;
  return {
    id: m.id,
    postgraduateId: m.recipientId,
    supervisorId: m.senderId,
    kind: m.feedbackKind || 'review',
    title: m.topic,
    body: m.text,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    postgraduate: m.recipient
      ? {
          id: m.recipient.id,
          fullName: m.recipient.fullName,
          groupName: m.recipient.groupName
        }
      : null
  };
}

module.exports = { messageToFeedback };
