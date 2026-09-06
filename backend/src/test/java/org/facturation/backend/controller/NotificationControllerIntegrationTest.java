package org.facturation.backend.controller;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.facturation.backend.model.Notification;
import org.facturation.backend.model.User;
import org.facturation.backend.repository.NotificationRepository;
import org.facturation.backend.repository.RoleRepository;
import org.facturation.backend.repository.UserRepository;
import org.facturation.backend.service.JwtTokenService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class NotificationControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private UserRepository userRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${app.jwt.secret}")
    private String jwtSecret;

    @Test
    void returnsOnlyCurrentUserNotificationsPaginatedAndSortedByNewestFirst() throws Exception {
        User currentUser = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        User otherUser = createOtherUser(currentUser);
        LocalDateTime now = LocalDateTime.now();
        createNotification(currentUser, "Old unread", false, now.minusHours(2));
        createNotification(currentUser, "Middle read", true, now.minusHours(1));
        createNotification(currentUser, "Newest unread", false, now);
        createNotification(otherUser, "Other user's notification", false, now.plusHours(1));

        mockMvc.perform(get("/api/v1/notifications")
                        .queryParam("page", "0")
                        .queryParam("size", "2")
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].message").value("Newest unread"))
                .andExpect(jsonPath("$.content[0].read").value(false))
                .andExpect(jsonPath("$.content[0].createdAt").isNotEmpty())
                .andExpect(jsonPath("$.content[1].message").value("Middle read"))
                .andExpect(jsonPath("$.content[1].read").value(true))
                .andExpect(jsonPath("$.totalElements").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void filtersCurrentUserNotificationsToUnreadOnly() throws Exception {
        User currentUser = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        User otherUser = createOtherUser(currentUser);
        LocalDateTime now = LocalDateTime.now();
        createNotification(currentUser, "Unread", false, now);
        createNotification(currentUser, "Read", true, now.minusMinutes(1));
        createNotification(otherUser, "Other user's unread", false, now.plusMinutes(1));

        mockMvc.perform(get("/api/v1/notifications")
                        .queryParam("unreadOnly", "true")
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.content[0].message").value("Unread"))
                .andExpect(jsonPath("$.content[0].read").value(false))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void marksOwnNotificationAsReadOnlyOnce() throws Exception {
        User currentUser = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        Notification notification = createNotification(currentUser, "Unread", false, LocalDateTime.now());

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notification.getNotificationId())
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.notificationId").value(notification.getNotificationId()))
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.readAt").isNotEmpty());

        entityManager.flush();
        entityManager.clear();
        LocalDateTime firstReadAt = notificationRepository.findById(notification.getNotificationId())
                .orElseThrow()
                .getReadAt();

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notification.getNotificationId())
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.readAt").isNotEmpty());

        entityManager.flush();
        entityManager.clear();
        Notification readAgain = notificationRepository.findById(notification.getNotificationId()).orElseThrow();
        assertThat(firstReadAt).isNotNull();
        assertThat(readAgain.getReadAt()).isEqualTo(firstReadAt);
    }

    @Test
    void cannotMarkAnotherUsersNotificationAsRead() throws Exception {
        User currentUser = userRepository.findByEmailIgnoreCase("admin@facturation-demo.fr").orElseThrow();
        User otherUser = createOtherUser(currentUser);
        Notification notification = createNotification(otherUser, "Other user's unread", false, LocalDateTime.now());

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", notification.getNotificationId())
                        .header("Authorization", "Bearer " + tokenFor(currentUser)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOTIFICATION_NOT_FOUND"));

        Notification unchanged = notificationRepository.findById(notification.getNotificationId()).orElseThrow();
        assertThat(unchanged.isRead()).isFalse();
        assertThat(unchanged.getReadAt()).isNull();
    }

    private User createOtherUser(User currentUser) {
        LocalDateTime now = LocalDateTime.now();
        User user = new User();
        user.setOrganization(currentUser.getOrganization());
        user.setRole(roleRepository.findByCode("OPERATEUR_COMPTABLE").orElseThrow());
        user.setFirstName("Other");
        user.setLastName("Recipient");
        user.setEmail("kan-196-other-recipient@example.com");
        user.setPasswordHash("not-used");
        user.setActive(true);
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        return userRepository.save(user);
    }

    private Notification createNotification(User recipient, String message, boolean read, LocalDateTime createdAt) {
        Notification notification = new Notification();
        notification.setRecipient(recipient);
        notification.setType("TEST_NOTIFICATION");
        notification.setMessage(message);
        notification.setRead(read);
        notification.setCreatedAt(createdAt);
        return notificationRepository.save(notification);
    }

    private String tokenFor(User user) {
        return new JwtTokenService(jwtSecret, Duration.ofHours(1)).generate(user);
    }
}
