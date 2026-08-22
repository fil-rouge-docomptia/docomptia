package org.facturation.backend.dto.response;

import java.time.LocalDateTime;

public class InvoiceHistoryItemResponse {

    private String type;
    private String action;
    private LocalDateTime date;
    private Long authorId;
    private String author;
    private String fieldName;
    private String oldValue;
    private String newValue;
    private String comment;
    private Long duplicateAlertId;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public LocalDateTime getDate() {
        return date;
    }

    public void setDate(LocalDateTime date) {
        this.date = date;
    }

    public Long getAuthorId() {
        return authorId;
    }

    public void setAuthorId(Long authorId) {
        this.authorId = authorId;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public String getOldValue() {
        return oldValue;
    }

    public void setOldValue(String oldValue) {
        this.oldValue = oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public void setNewValue(String newValue) {
        this.newValue = newValue;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Long getDuplicateAlertId() {
        return duplicateAlertId;
    }

    public void setDuplicateAlertId(Long duplicateAlertId) {
        this.duplicateAlertId = duplicateAlertId;
    }
}
