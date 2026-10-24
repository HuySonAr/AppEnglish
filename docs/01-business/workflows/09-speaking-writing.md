# Speaking, Writing và giáo viên

Nghiệp vụ chốt ngày 2026-10-23 (D169–D174). Ngân hàng đề và duyệt đề đã triển khai ở F11 (D176), Speaking đọc to ở F12 (D177), key Gemini và Writing ở F13 (D178), Speaking nói mở ở F14 (D179), giáo viên chấm ở F15 (D180), hồ sơ CEFR và công cụ đánh giá AI ở F16 (D181).

## Vai trò

| Vai trò | Việc |
|---|---|
| Teacher (mới) | Soạn đề Speaking và Writing theo cấp CEFR, gửi duyệt, sửa đề khi có lỗi; chấm bài học viên gửi (hàng chờ chung). Không soạn lesson, mock, bài nghe; không có lớp học |
| Content Manager | Duyệt đề do giáo viên gửi: xuất bản hoặc trả lại kèm góp ý; gỡ đề đã xuất bản. Không soạn hay sửa nội dung đề Speaking/Writing |
| Admin | Tạo và quản lý tài khoản giáo viên như các vai trò khác |
| Student | Chọn đề theo cấp CEFR, làm bài, nhận điểm tự động, gửi giáo viên chấm (3 lượt/tuần) |

Không có lớp học, mã lớp, giao bài (assignment) hay buổi học trực tiếp. Mọi giáo viên dùng chung một hàng chờ bài.

## Ngân hàng đề

Mỗi đề có: loại, cấp CEFR (A1–C2), chủ đề, tiêu đề, người soạn.

| Loại | Nội dung đề | Bài mẫu | Ý chính |
|---|---|---|---|
| Speaking – đọc to (`read_aloud`) | Câu hoặc đoạn ngắn để đọc; audio mẫu (giáo viên tải lên hoặc bấm tạo bằng giọng máy Piper Anh-Anh, D123, D177) | Không cần (câu mẫu chính là đáp án) | Không |
| Speaking – nói mở (`open_speaking`) | Yêu cầu (mô tả tranh, trả lời câu hỏi, nêu ý kiến), có thể kèm hình; thời gian nói tối đa | Bắt buộc (một bài nói mẫu dạng chữ) | Không bắt buộc |
| Writing (`writing`) | Loại bài (câu, email, đoạn văn, bài luận ngắn), đề bài, có thể kèm hình; số từ tối thiểu và tối đa | Bắt buộc | Không bắt buộc |

- Bài mẫu là mốc tham khảo cho AI và giáo viên khi chấm, không phải đáp án so từng chữ: ý khác nhưng đúng đề không bị trừ.
- Ý chính là danh sách các ý đề yêu cầu (ví dụ "nêu lý do xin nghỉ, đề xuất ngày bù, lời cảm ơn"); khi có, AI và giáo viên chấm mức hoàn thành yêu cầu đề theo danh sách này.
- Bài mẫu và ý chính chỉ dùng làm đầu vào cho AI chấm và để giáo viên tham khảo; học viên không bao giờ thấy, kể cả sau khi nộp (D185).

## Duyệt và xuất bản đề

1. Giáo viên soạn nháp (chỉ người soạn thấy và sửa), rồi bấm "Gửi duyệt".
2. Content Manager xem đề trong danh sách chờ duyệt:
   - Duyệt: đề được xuất bản, học viên thấy.
   - Trả lại: đề quay về giáo viên kèm góp ý bắt buộc.
3. Đề đã xuất bản bị lỗi: giáo viên sửa thành bản mới và gửi duyệt lại; bản đang xuất bản vẫn dùng cho đến khi bản mới được duyệt. Mọi sửa đổi, kể cả lỗi chính tả, đều qua duyệt.
4. Lỗi nặng: Content Manager gỡ đề ngay; đề gỡ không hiện cho học viên, bài đã nộp vẫn xem được.
5. Mỗi bài nộp lưu bản chụp đề lúc làm (nội dung, bài mẫu, ý chính, cấp), nên sửa hay gỡ đề không đổi bài đã chấm.
6. Chỉ người soạn sửa đề của mình; Content Manager không sửa nội dung đề.

Trạng thái một bản đề: `DRAFT` → `PENDING_REVIEW` → `PUBLISHED` hoặc `RETURNED` (về lại `DRAFT` khi giáo viên sửa). Gỡ đề: `UNPUBLISHED`.

## Học viên làm bài

- Practice có thêm hai mục: Speaking và Writing. Danh sách đề có tìm kiếm, lọc theo cấp CEFR, chủ đề, loại, trạng thái (chưa làm, đã làm, điểm cao nhất) và phân trang.
- Mặc định mở ở cấp CEFR hiện tại của kỹ năng đó trong hồ sơ năng lực (chưa có thì A2); nếu cấp đó chưa có đề thì mở cấp gần nhất có đề, không bao giờ mở một danh sách trống khi đã có đề (D183).
- Speaking – đọc to: nghe mẫu, ghi âm trên trình duyệt (tối đa 30 giây), nộp.
- Speaking – nói mở: đọc yêu cầu, ghi âm (tối đa theo đề, không quá 2 phút), nộp.
- Writing: viết trong ô soạn có đếm từ; nộp khi đủ số từ tối thiểu và không quá số từ tối đa.
- Trang đề có hai tab: làm bài (đề, chỗ làm, kết quả lần vừa nộp) và lịch sử (danh sách các lần nộp và kết quả từng lần) (D185).
- Sau khi nộp, bài ở trạng thái "đang chấm"; có kết quả thì hiện ngay và có thông báo. Học viên làm lại đề bao nhiêu lần cũng được; mỗi đề có lịch sử các lần nộp, điểm AI và điểm giáo viên (nếu có).
- Nộp bài Speaking/Writing tính là một ngày học của streak (D154).

## Chấm tự động

### Speaking – đọc to (Whisper, miễn phí)
- speech-service nhận dạng bằng Whisper, lấy từng từ kèm độ tin cậy, căn chỉnh chuỗi từ nghe được với câu mẫu.
- Mỗi từ của câu mẫu có trạng thái: đúng, phát âm sai (khớp nhưng độ tin cậy thấp), thiếu; từ thừa được liệt kê riêng.
- Điểm theo thang 0–10 như Speechocean762: Accuracy, Completeness, Fluency (tốc độ nói, khoảng ngừng) và Total; công thức và ngưỡng ở D177 (F16 đối chiếu lại với Speechocean762).
- Giới hạn ghi rõ cho học viên: Whisper có thể "tự sửa" từ phát âm sai thành từ đúng, nên lỗi phát âm nhỏ có thể bị bỏ sót.

### Speaking – nói mở và Writing (Gemini bằng key của học viên)
- Speaking nói mở: Whisper chuyển giọng nói thành chữ; Gemini chấm phần chữ; Fluency và Pronunciation lấy từ số liệu Whisper (tốc độ, khoảng ngừng, độ tin cậy từng từ). Gemini không nghe giọng, nên phát âm và ngữ điệu chỉ đánh giá gần đúng.
- Gemini nhận: đề, cấp CEFR của đề, bài mẫu, ý chính (nếu có), rubric từng mức và bài của học viên; trả JSON đúng khuôn; temperature 1.0 theo khuyến nghị của Google cho Gemini 3 (D178); JSON sai khuôn thì thử lại một lần.
- Writing: điểm 1–5 theo sáu tiêu chí của ELLIPSE (cohesion, syntax, vocabulary, phraseology, grammar, conventions), cộng tiêu chí hoàn thành yêu cầu đề (theo bài mẫu và ý chính). Giao diện gộp thành Từ vựng (vocabulary, phraseology), Ngữ pháp (syntax, grammar, conventions), Mạch lạc (cohesion) và Hoàn thành đề; điểm tổng là trung bình 4 nhóm (D178).
- Speaking nói mở: điểm 1–5 cho Hoàn thành đề, Từ vựng, Ngữ pháp, Mạch lạc; Fluency/Pronunciation 0–10 từ Whisper; điểm tổng 0–10 = 60% Gemini (quy về thang 10) + 20% Fluency + 20% Pronunciation (D179).
- Nhận xét: một đoạn nhận xét chung; danh sách lỗi (đoạn sai, gợi ý sửa, giải thích ngắn) tô ngay trong bài; có thể kèm bản viết lại tốt hơn.
- Gemini nhận xét theo kỳ vọng của cấp đề (bài A2 không bị đòi cấu trúc C1), nhưng điểm vẫn theo thang cố định để so được với dữ liệu chuyên gia.
- Rubric cố định. Học viên tự chọn model Gemini (trong danh sách Flash ổn định) và mức suy nghĩ cho key của mình; mỗi kết quả ghi model đã chấm (D184).

### Key Gemini của học viên
- Học viên tự tạo API key Gemini bằng tài khoản Google của mình (Google AI Studio) và dán vào trang Profile; có trang hướng dẫn từng bước.
- Máy chủ gọi Gemini bằng key đó (không gọi từ trình duyệt, để điểm không bị sửa và rubric không lộ). Key được kiểm tra bằng một lệnh gọi nhỏ khi lưu, lưu mã hóa, không bao giờ trả về trình duyệt (chỉ hiện 4 ký tự cuối), không ghi vào log; học viên xóa được bất cứ lúc nào.
- Khi dán key, app ghi rõ: với gói miễn phí, Google có thể dùng dữ liệu gửi lên để cải thiện sản phẩm; lượt dùng thuộc hạn mức của tài khoản Google đó.
- Key hết hạn mức hoặc Gemini lỗi: bài chờ trong hàng đợi và thử lại (D168); vẫn lỗi thì bài ở trạng thái "chưa chấm được" kèm lý do (ví dụ "Gemini của bạn đã hết lượt hôm nay") và học viên có thể gửi giáo viên chấm.
- Không có key: đề đọc to vẫn chấm tự động; đề nói mở hiện phần chữ Whisper nghe được kèm Fluency và Pronunciation, không có điểm tổng (D179); bài Writing chỉ được lưu. Cả hai có nút "Gửi giáo viên chấm".
- Hệ thống không tự trả tiền AI cho học viên; không có key chung của hệ thống cho học viên.

## Giáo viên chấm

- Mỗi học viên có 3 lượt giáo viên chấm mỗi tuần, tính chung cho Speaking và Writing; tuần từ thứ 2 đến chủ nhật theo giờ Việt Nam; lượt không dùng không cộng dồn. Trang làm bài hiện "Còn n/3 lượt tuần này".
- Học viên chọn "Gửi giáo viên chấm" cho một bài đã nộp (mỗi bài gửi một lần; bài bị trả lại được gửi lại). Gửi là giữ một chỗ trong 3 lượt của tuần; chỗ chỉ mất hẳn khi giáo viên chấm xong, bài bị trả thì hoàn chỗ (D180). Bài còn chờ và chưa giáo viên nào nhận thì học viên rút lại được, lượt được hoàn (D182).
- Hàng chờ chung cho mọi giáo viên, cũ trước; giáo viên nhận một bài thì bài bị khóa cho người đó (2 giờ); hết giờ chưa chấm thì bài trở lại hàng chờ.
- Bài chờ quá 48 giờ mà chưa giáo viên nào chấm: rút khỏi hàng chờ, trả lại lượt và báo học viên.
- Giáo viên thấy bản chụp đề, bài mẫu, ý chính, bài của học viên (nghe bản ghi hoặc đọc bài) và điểm AI nếu có. Việc có thể làm:
  - Xác nhận điểm AI.
  - Sửa điểm từng tiêu chí và ghi nhận xét (Writing chấm theo 4 nhóm hiển thị, D180).
  - Chấm từ đầu khi chưa có điểm AI.
- Nhận xét của giáo viên là bắt buộc khi sửa điểm hoặc chấm từ đầu.
- Kết quả: nhãn "AI score" đổi thành "Reviewed by teacher"; điểm giáo viên thay điểm AI trong hồ sơ năng lực; học viên nhận thông báo.
- Mỗi lần chấm được ghi lại (giáo viên, bài, loại việc, điểm trước và sau, lúc nhận, lúc xong) để thống kê; chưa tính lương (TBD).

## Hồ sơ năng lực CEFR

Hồ sơ hiện cấp CEFR riêng cho bốn kỹ năng trên trang Progress và trang chủ học viên; không có bài placement CEFR mới, placement TOEIC giữ nguyên.

- Listening và Reading: quy đổi điểm TOEIC ước tính của lượt full mock gần nhất theo bảng quy đổi TOEIC–CEFR của ETS (đã đối chiếu tài liệu ETS bản 2025, D181: Listening A1 60, A2 110, B1 275, B2 400, C1 490; Reading A1 60, A2 115, B1 275, B2 385, C1 455; dưới A1 hiện "Below A1"). Chưa có full mock thì chưa có cấp.
- Speaking (chỉ bài Nói mở) và Writing: cấp cao nhất mà trong 5 bài có điểm mới nhất ở đề cấp đó có ít nhất 3 bài đạt mức đạt (D181) (Speaking Total ≥ 7/10; Writing tổng ≥ 3,5/5). Điểm giáo viên được dùng thay điểm AI khi có. Chưa đủ bài thì chưa có cấp. Ngưỡng là đề xuất, có thể đổi.
- Thang CEFR là thang năng lực chung để hiển thị; mục tiêu điểm, kế hoạch học và dự báo (D165, D166) vẫn theo TOEIC.

## Luồng bất đồng bộ và thông báo

Nộp bài → lưu bài và ghi outbox trong cùng giao dịch → RabbitMQ → worker AI (speech-service cho Whisper; worker Gemini cho nói mở và Writing) → kết quả có `messageId`, chống trùng, thử lại và hàng đợi chết theo D168 → lưu điểm → event sang progress (hồ sơ năng lực, streak) → thông báo cho học viên. Worker AI chạy được nhiều bản song song để tăng tải.

Thông báo mới cho học viên: bài đã được AI chấm, AI chưa chấm được (kèm lý do), giáo viên đã chấm, lượt giáo viên được trả lại. Cho giáo viên: đề bị trả lại kèm góp ý, đề đã được xuất bản. Cho Content Manager: có đề mới chờ duyệt.

## Đánh giá độ chính xác AI

- Speaking đọc to: 100–200 mẫu Speechocean762; so Accuracy, Fluency, Completeness, Total với điểm chuyên gia; Pearson, Spearman, MAE.
- Writing: 100–200 bài ELLIPSE; so sáu tiêu chí và điểm tổng; Pearson, Spearman, MAE, QWK.
- Chạy bằng key của người phát triển, cùng model và prompt với hệ thống; kết quả ghi vào tài liệu đánh giá.

## Ngoài phạm vi

Lớp học, mã lớp, giao bài có hạn nộp, buổi học trực tiếp; tính lương giáo viên (dữ liệu đã được ghi lại, cách tính để sau); placement CEFR mới; ôn từ vựng lặp lại ngắt quãng (SM-2); key AI chung do hệ thống trả tiền cho học viên.
